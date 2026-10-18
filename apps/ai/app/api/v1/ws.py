"""Real-time WebSockets integration for Voice and Text chat."""

from __future__ import annotations

import base64
import json

import structlog
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.config import Settings, get_settings
from app.core.security import verify_token
from app.services.llm import stream_generate
from app.services.safety import SafetyService
from app.services.voice import VoiceService

log = structlog.get_logger(__name__)
router = APIRouter()

@router.websocket("/chat")
async def websocket_chat(
    websocket: WebSocket,
    settings: Settings = Depends(get_settings)
) -> None:
    await websocket.accept()
    
    # 1. Authenticate first message
    try:
        auth_msg_raw = await websocket.receive_text()
        auth_msg = json.loads(auth_msg_raw)
        if auth_msg.get("type") != "auth" or not auth_msg.get("token"):
            await websocket.close(code=1008, reason="Expected auth message")
            return
        
        principal = verify_token(auth_msg["token"], settings)
    except Exception as exc:
        log.warning("websocket_auth_failed", error=str(exc))
        if not websocket.client_state.name == "DISCONNECTED":
            await websocket.close(code=1008, reason="Authentication failed")
        return

    safety_service = SafetyService(settings)
    voice_service = VoiceService(settings)

    try:
        while True:
            # 2. Receive message
            raw_msg = await websocket.receive_text()
            msg = json.loads(raw_msg)
            msg_type = msg.get("type")
            
            transcript = ""
            
            if msg_type == "text":
                transcript = msg.get("content", "")
            elif msg_type == "audio":
                # Decode base64 audio and run STT
                b64_audio = msg.get("data", "")
                audio_bytes = base64.b64decode(b64_audio)
                transcript = await voice_service.transcribe(audio_bytes, "ws_audio.wav")
            else:
                await websocket.send_json({"type": "error", "message": "Unknown message type"})
                continue
                
            if not transcript.strip():
                continue

            # 3. Check Safety of input
            safety_check = await safety_service.check_prompt(transcript)
            if not safety_check.is_safe:
                reject = "I'm sorry, I cannot fulfill that request."
                await websocket.send_json({"type": "token", "content": reject})
                # Synthesize rejection (best-effort, like every spoken reply)
                if voice_service.tts_available:
                    try:
                        audio_bytes = await voice_service.synthesize(reject)
                        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
                        await websocket.send_json({"type": "audio", "data": b64_audio})
                    except Exception as e:
                        log.error("websocket_tts_error", error=str(e))
                continue
                
            # 4. Stream LLM response
            full_response = []
            try:
                system_prompt = "You are a helpful voice assistant. Keep your answers concise, 1-3 sentences max."
                async for kind, payload in stream_generate(
                    settings, system=system_prompt, prompt=transcript
                ):
                    if kind == "token" and isinstance(payload, str):
                        full_response.append(payload)
                        await websocket.send_json({"type": "token", "content": payload})
                    elif kind == "error" and isinstance(payload, str):
                        await websocket.send_json({"type": "error", "message": payload})
            except Exception as e:
                log.error("websocket_llm_error", error=str(e))
                await websocket.send_json({"type": "error", "message": "Generation failed"})
                continue
                
            resp_text = "".join(full_response)
            
            # 5. Check Safety of output
            out_safety = await safety_service.check_prompt(resp_text)
            if not out_safety.is_safe:
                msg_txt = "I generated a response, but it was flagged as unsafe."
                await websocket.send_json({"type": "error", "message": msg_txt})
                continue
                
            # 6. Run TTS and send audio back
            if voice_service.tts_available:
                try:
                    out_audio_bytes = await voice_service.synthesize(resp_text)
                    out_b64_audio = base64.b64encode(out_audio_bytes).decode("utf-8")
                    await websocket.send_json({"type": "audio", "data": out_b64_audio})
                except Exception as e:
                    log.error("websocket_tts_error", error=str(e))
                    await websocket.send_json({"type": "error", "message": "TTS failed"})

    except WebSocketDisconnect:
        log.info("websocket_disconnected", user_id=principal.user_id)
    except Exception as exc:
        log.error("websocket_error", error=str(exc))
        if not websocket.client_state.name == "DISCONNECTED":
            await websocket.close(code=1011, reason="Internal server error")
