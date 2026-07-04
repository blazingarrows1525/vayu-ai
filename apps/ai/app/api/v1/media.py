"""Media API (Voice & Video)."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.db.base import get_session
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
    
    # 2. If it's a chat action, we pass it to LLM and synthesize the response
    if action == "chat":
        import base64

        from app.services.llm import generate
        from app.services.safety import SafetyService

        safety_service = SafetyService(settings)
        
        # Check input safety
        safety_check = await safety_service.check_prompt(transcript)
        if not safety_check.is_safe:
            msg = "I'm sorry, I cannot fulfill that request."
            # Synthesize rejection message
            audio_bytes = await voice_service.synthesize(msg)
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            return VoiceResponse(transcript=msg, audio_url=f"data:audio/wav;base64,{b64_audio}")

        # Generate response
        resp, _ = await generate(settings, system="You are a helpful voice assistant. Keep your answers concise, 1-3 sentences max.", prompt=transcript)
        
        # Check output safety
        out_safety_check = await safety_service.check_prompt(resp)
        if not out_safety_check.is_safe:
            msg = "I generated a response, but it was flagged as unsafe."
            audio_bytes = await voice_service.synthesize(msg)
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            return VoiceResponse(transcript=msg, audio_url=f"data:audio/wav;base64,{b64_audio}")

        # Synthesize actual response
        out_audio_bytes = await voice_service.synthesize(resp)
        out_b64_audio = base64.b64encode(out_audio_bytes).decode("utf-8")
        
        return VoiceResponse(transcript=resp, audio_url=f"data:audio/wav;base64,{out_b64_audio}")
        
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
