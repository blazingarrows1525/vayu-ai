"""Media API (Voice & Video).

Both endpoints act inside the caller's workspace (from the verified JWT, never
from form data). Video summaries and voice *transcriptions* feed that workspace's
RAG; voice *chat* turns are conversational and are not stored.
"""

import base64
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import Principal, get_principal, require_workspace
from app.db.base import get_session
from app.rag.pipeline import ingest_document
from app.services.llm import LLMError, LLMUnavailable, generate, live_llm_kwargs
from app.services.safety import SafetyService
from app.services.video import VideoProcessingError, VideoService
from app.services.voice import VoiceService

router = APIRouter()
log = structlog.get_logger(__name__)

_VOICE_SYSTEM = "You are a helpful voice assistant. Keep your answers concise, 1-3 sentences max."


class VoiceResponse(BaseModel):
    transcript: str
    audio_url: str | None = None


class VideoResponse(BaseModel):
    summary: str


async def _read_upload(file: UploadFile, settings: Settings) -> bytes:
    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File is {len(data) // (1024 * 1024)}MB; the limit is {settings.max_upload_mb}MB.",
        )
    return data


async def _remember(session: AsyncSession, settings: Settings, principal: Principal,
                    workspace_id: str, *, title: str, source_type: str, text: str) -> None:
    """Save into the workspace's knowledge base, best-effort: the user still gets their
    transcript/summary if storage or embeddings are unavailable."""
    try:
        await ingest_document(
            session, settings,
            workspace_id=workspace_id,
            created_by=principal.user_id,
            document_id=None,
            title=title,
            source_type=source_type,
            text=text,
        )
    except Exception as exc:  # noqa: BLE001 - logged; the response doesn't depend on it
        await session.rollback()
        log.warning("media_ingest_failed", source_type=source_type, error=str(exc))


async def _speak(voice_service: VoiceService, text: str) -> str | None:
    """Best-effort TTS as a data URL; None means reply text-only."""
    if not voice_service.tts_available:
        return None
    try:
        audio = await voice_service.synthesize(text)
    except Exception:  # noqa: BLE001 - logged in the service; a voice reply still has text
        return None
    return f"data:audio/wav;base64,{base64.b64encode(audio).decode('utf-8')}"


@router.post("/voice", response_model=VoiceResponse)
async def process_voice(
    file: UploadFile = File(...),
    action: Literal["transcribe", "chat"] = Form("transcribe"),
    principal: Principal = Depends(get_principal),
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_session),
) -> VoiceResponse:
    """Processes uploaded voice audio. Can either just transcribe, or act as a voice chat."""
    workspace_id = require_workspace(principal)
    voice_service = VoiceService(settings)
    if not voice_service.available:
        raise HTTPException(status_code=503, detail="Voice service not configured.")

    audio_bytes = await _read_upload(file, settings)
    filename = file.filename or "audio.wav"

    # 1. Transcribe the user's voice
    try:
        transcript = await voice_service.transcribe(audio_bytes, filename)
    except Exception as exc:  # noqa: BLE001 - logged in the service
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Transcription failed.") from exc

    # Ingest dictated transcripts into RAG (chat questions are not knowledge)
    if action == "transcribe" and transcript.strip():
        await _remember(session, settings, principal, workspace_id,
                        title=f"{filename}.transcript", source_type="audio", text=transcript)

    # 2. If it's a chat action, we pass it to LLM and synthesize the response
    if action == "chat":
        if not transcript.strip():
            msg = "I didn't catch that — please try again."
            return VoiceResponse(transcript=msg, audio_url=await _speak(voice_service, msg))

        safety_service = SafetyService(settings)

        # Check input safety
        safety_check = await safety_service.check_prompt(transcript)
        if not safety_check.is_safe:
            msg = "I'm sorry, I cannot fulfill that request."
            return VoiceResponse(transcript=msg, audio_url=await _speak(voice_service, msg))

        # Generate response
        try:
            resp, _ = await generate(
                settings, system=_VOICE_SYSTEM, prompt=transcript, **live_llm_kwargs(settings)
            )
        except LLMUnavailable as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        except LLMError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Generation failed.") from exc

        # Check output safety
        out_safety_check = await safety_service.check_prompt(resp)
        if not out_safety_check.is_safe:
            msg = "I generated a response, but it was flagged as unsafe."
            return VoiceResponse(transcript=msg, audio_url=await _speak(voice_service, msg))

        return VoiceResponse(transcript=resp, audio_url=await _speak(voice_service, resp))

    return VoiceResponse(transcript=transcript)


@router.post("/video", response_model=VideoResponse)
async def process_video(
    file: UploadFile = File(...),
    principal: Principal = Depends(get_principal),
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_session),
) -> VideoResponse:
    """Processes uploaded video for summarization."""
    workspace_id = require_workspace(principal)
    video_service = VideoService(settings)
    if not video_service.available:
        raise HTTPException(status_code=503, detail="Video intelligence not configured.")

    video_bytes = await _read_upload(file, settings)
    filename = file.filename or "video.mp4"

    try:
        summary = await video_service.summarize_video(
            video_bytes, filename, VoiceService(settings)
        )
    except VideoProcessingError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    # Ingest the video summary into RAG
    await _remember(session, settings, principal, workspace_id,
                    title=f"{filename}.summary", source_type="video", text=summary)

    return VideoResponse(summary=summary)
