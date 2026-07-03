"""Media API (Voice & Video)."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.db.core import get_session
from app.services.video import VideoService
from app.services.voice import VoiceService

router = APIRouter()


class VoiceResponse(BaseModel):
    transcript: str
    audio_url: str | None = None


class VideoResponse(BaseModel):
    summary: str


@router.post("/voice", response_model=VoiceResponse)
async def process_voice(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
    action: str = Form("transcribe"), # transcribe or chat
    settings: Settings = Depends(get_settings),
    session = Depends(get_session),
) -> VoiceResponse:
    """Processes uploaded voice audio. Can either just transcribe, or act as a voice chat."""
    voice_service = VoiceService(settings)
    if not voice_service.available:
        raise HTTPException(status_code=503, detail="Voice service not configured.")

    audio_bytes = await file.read()
    filename = file.filename or "audio.wav"
    
    # 1. Transcribe the user's voice
    transcript = await voice_service.transcribe(audio_bytes, filename)
    
    # Ingest the transcript into RAG
    if transcript.strip():
        from app.rag.pipeline import ingest_document
        await ingest_document(
            session, settings,
            workspace_id=workspace_id,
            created_by=None,
            document_id=None,
            title=f"{filename}.transcript",
            source_type="audio",
            text=transcript
        )
    
    # 2. If it's a chat action, we could pass it to LLM and synthesize the response
    if action == "chat":
        from app.services.llm import generate
        resp, _ = await generate(settings, system="You are a voice assistant.", prompt=transcript)
        return VoiceResponse(transcript=resp, audio_url=None)
        
    return VoiceResponse(transcript=transcript)


@router.post("/video", response_model=VideoResponse)
async def process_video(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    session = Depends(get_session),
) -> VideoResponse:
    """Processes uploaded video for summarization."""
    voice_service = VoiceService(settings)
    video_service = VideoService(settings)
    
    video_bytes = await file.read()
    filename = file.filename or "video.mp4"
    
    summary = await video_service.summarize_video(video_bytes, filename, voice_service)
    
    # Ingest the video summary into RAG
    if summary.strip():
        from app.rag.pipeline import ingest_document
        await ingest_document(
            session, settings,
            workspace_id=workspace_id,
            created_by=None,
            document_id=None,
            title=f"{filename}.summary",
            source_type="video",
            text=summary
        )
    
    return VideoResponse(summary=summary)
