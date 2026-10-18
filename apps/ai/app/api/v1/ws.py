"""VAYU Live — realtime voice + text chat over a WebSocket.

Protocol (JSON text frames):
  client → {"type": "auth", "token": <JWT>}                       first frame, required
  server → {"type": "ready", "stt": bool, "tts": bool}
  client → {"type": "text", "content": str, "speak"?: bool}
         | {"type": "audio", "data": <base64>, "mime"?: str, "speak"?: bool}
         | {"type": "ping"}                                        → {"type": "pong"}
  server → {"type": "transcript", "content": str}                 audio turns: what we heard
         → {"type": "token", "content": str} …                     the streamed reply
         → {"type": "audio", "data": <base64 wav>, "mime": "audio/wav"}   best-effort TTS
         → {"type": "error", "message": str, "retract"?: bool}    turn-level; socket stays open
         → {"type": "done"}                                        ends every turn

`retract` means the streamed reply was flagged after the fact and must be hidden.
Conversations are not persisted; a short rolling history gives the model context.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import json
import time

import structlog
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.config import Settings, get_settings
from app.core.ratelimit import allow_request
from app.core.security import verify_token
from app.services.llm import LLMUnavailable, live_llm_kwargs, stream_generate
from app.services.safety import SafetyService
from app.services.voice import VoiceService

log = structlog.get_logger(__name__)
router = APIRouter()

_LIVE_SYSTEM = (
    "You are VAYU, a realtime voice assistant. Answer conversationally and concisely — "
    "1-3 sentences unless the user asks for more. No markdown or lists: your words may be "
    "spoken aloud."
)
_HISTORY_TURNS = 6
_MAX_TEXT_CHARS = 4000
_MAX_TTS_CHARS = 4000
_AUDIO_EXT = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
}


def _audio_filename(mime: object) -> str:
    """STT providers (OpenAI especially) infer the codec from the file extension."""
    base = str(mime or "").split(";")[0].strip().lower()
    return "live" + _AUDIO_EXT.get(base, ".webm")


def _prompt(history: list[tuple[str, str]], message: str) -> str:
    if not history:
        return message
    turns = "\n".join(f"User: {u}\nAssistant: {a}" for u, a in history)
    return f"Conversation so far:\n{turns}\n\nUser: {message}"


async def _speak(websocket: WebSocket, voice: VoiceService, text: str) -> None:
    """Best-effort TTS — a reply always has text, audio is a bonus."""
    try:
        audio = await voice.synthesize(text[:_MAX_TTS_CHARS])
    except Exception as exc:  # noqa: BLE001 - logged; the text reply already went out
        log.error("websocket_tts_error", error=str(exc))
        return
    await websocket.send_json(
        {"type": "audio", "data": base64.b64encode(audio).decode("utf-8"), "mime": "audio/wav"}
    )


async def _fail_turn(websocket: WebSocket, message: str, *, retract: bool = False) -> None:
    payload: dict = {"type": "error", "message": message}
    if retract:
        payload["retract"] = True
    await websocket.send_json(payload)
    await websocket.send_json({"type": "done"})


@router.websocket("/chat")
async def websocket_chat(
    websocket: WebSocket,
    settings: Settings = Depends(get_settings)
) -> None:
    await websocket.accept()

    # 1. Authenticate first message (JWKS fetch is blocking I/O → thread)
    try:
        auth_msg = json.loads(await websocket.receive_text())
        if not isinstance(auth_msg, dict) or auth_msg.get("type") != "auth" or not auth_msg.get("token"):
            await websocket.close(code=1008, reason="Expected auth message")
            return
        principal = await asyncio.to_thread(verify_token, str(auth_msg["token"]), settings)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        log.warning("websocket_auth_failed", error=str(exc))
        await websocket.close(code=1008, reason="Authentication failed")
        return

    safety_service = SafetyService(settings)
    voice_service = VoiceService(settings)
    history: list[tuple[str, str]] = []
    max_audio_bytes = settings.max_upload_mb * 1024 * 1024
    await websocket.send_json(
        {"type": "ready", "stt": voice_service.available, "tts": voice_service.tts_available}
    )

    try:
        while True:
            # 2. Receive message
            try:
                msg = json.loads(await websocket.receive_text())
            except json.JSONDecodeError:
                await _fail_turn(websocket, "Malformed message.")
                continue
            if not isinstance(msg, dict):
                await _fail_turn(websocket, "Malformed message.")
                continue
            msg_type = msg.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if msg_type not in ("text", "audio"):
                await _fail_turn(websocket, "Unknown message type.")
                continue

            window = 60
            key = f"rl:ws:{principal.user_id}:{int(time.time() // window)}"
            if not await allow_request(key, settings.live_turns_per_min, window):
                await _fail_turn(websocket, "You're going a bit fast — wait a moment and try again.")
                continue

            speak = bool(msg.get("speak", True)) and voice_service.tts_available

            if msg_type == "text":
                transcript = str(msg.get("content", ""))[:_MAX_TEXT_CHARS]
            else:
                if not voice_service.available:
                    await _fail_turn(websocket, "Voice input isn't configured on this server.")
                    continue
                try:
                    audio_bytes = base64.b64decode(str(msg.get("data", "")), validate=True)
                except (binascii.Error, ValueError):
                    await _fail_turn(websocket, "Audio frame is not valid base64.")
                    continue
                if len(audio_bytes) > max_audio_bytes:
                    await _fail_turn(websocket, "That recording is too long.")
                    continue
                try:
                    transcript = await voice_service.transcribe(
                        audio_bytes, _audio_filename(msg.get("mime"))
                    )
                except Exception:  # noqa: BLE001 - logged in the service
                    await _fail_turn(websocket, "Couldn't transcribe that audio.")
                    continue
                await websocket.send_json({"type": "transcript", "content": transcript})

            if not transcript.strip():
                await _fail_turn(websocket, "I didn't catch that — try again.")
                continue

            # 3. Check Safety of input
            safety_check = await safety_service.check_prompt(transcript)
            if not safety_check.is_safe:
                reject = "I'm sorry, I cannot fulfill that request."
                await websocket.send_json({"type": "token", "content": reject})
                if speak:
                    await _speak(websocket, voice_service, reject)
                await websocket.send_json({"type": "done"})
                continue

            # 4. Stream LLM response
            full_response: list[str] = []
            failed = False
            try:
                async for kind, payload in stream_generate(
                    settings, system=_LIVE_SYSTEM, prompt=_prompt(history, transcript),
                    **live_llm_kwargs(settings),
                ):
                    if kind == "token" and isinstance(payload, str):
                        full_response.append(payload)
                        await websocket.send_json({"type": "token", "content": payload})
                    elif kind == "error":
                        log.error("websocket_llm_stream_error", error=str(payload))
                        failed = True
            except LLMUnavailable:
                await _fail_turn(websocket, "No language model is configured.")
                continue
            except WebSocketDisconnect:
                raise
            except Exception as e:
                log.error("websocket_llm_error", error=str(e))
                failed = True

            resp_text = "".join(full_response)
            if failed or not resp_text.strip():
                await _fail_turn(websocket, "Generation failed — please try again.")
                continue

            # 5. Check Safety of output
            out_safety = await safety_service.check_prompt(resp_text)
            if not out_safety.is_safe:
                await _fail_turn(
                    websocket, "That response was flagged as unsafe and withheld.", retract=True
                )
                continue

            history.append((transcript, resp_text))
            del history[:-_HISTORY_TURNS]

            # 6. Run TTS and send audio back
            if speak:
                await _speak(websocket, voice_service, resp_text)
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        log.info("websocket_disconnected", user_id=principal.user_id)
    except Exception as exc:
        log.error("websocket_error", error=str(exc))
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close(code=1011, reason="Internal server error")
