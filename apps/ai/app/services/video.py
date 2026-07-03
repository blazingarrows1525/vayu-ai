"""Video Intelligence Service."""

from __future__ import annotations

import asyncio
import base64
import tempfile
from pathlib import Path

import structlog
from openai import AsyncOpenAI

from app.core.config import Settings
from app.services.voice import VoiceService

log = structlog.get_logger(__name__)


class VideoService:
    """Handles video processing: keyframe extraction, audio transcription, and summarization."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def summarize_video(
        self, 
        video_bytes: bytes, 
        filename: str, 
        voice_service: VoiceService
    ) -> str:
        """Process a video file to generate a summary."""
        # This is a CPU intensive task, should be run in a background worker in a real system.
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            video_path = tmp_path / filename
            video_path.write_bytes(video_bytes)
            
            audio_path = tmp_path / "audio.wav"
            
            # 1. Extract audio
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-i", str(video_path), "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", str(audio_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await proc.communicate()
            except Exception as e:
                log.error("video_audio_extract_failed", error=str(e))
                return "Failed to process video: ffmpeg audio extraction failed."

            if not audio_path.exists():
                log.warning("video_no_audio_found")
                transcript = "[No audio detected in video]"
            else:
                # 2. Transcribe audio
                audio_bytes = audio_path.read_bytes()
                try:
                    transcript = await voice_service.transcribe(audio_bytes, "audio.wav")
                except Exception as e:
                    log.error("video_transcription_failed", error=str(e))
                    transcript = "[Failed to transcribe audio]"

            # 3. Extract 1 keyframe every 10 seconds to save tokens
            frames_dir = tmp_path / "frames"
            frames_dir.mkdir()
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-i", str(video_path), "-vf", "fps=1/10", f"{frames_dir}/frame_%03d.jpg",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await proc.communicate()
            except Exception as e:
                log.error("video_frame_extract_failed", error=str(e))
            
            frame_files = sorted(list(frames_dir.glob("*.jpg")))
            # Limit to max 10 frames to not blow up context
            frame_files = frame_files[:10]
            
            # 4. Ask Vision model to summarize based on frames + transcript
            content: list[dict] = [
                {"type": "text", "text": f"Here is the audio transcript of the video:\n\n{transcript}\n\nHere are some sampled frames from the video. Please provide a detailed summary of the video, including key moments."}
            ]
            
            for frame_file in frame_files:
                b64_img = base64.b64encode(frame_file.read_bytes()).decode("utf-8")
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}
                })

            messages: list[dict] = [{"role": "user", "content": content}]
            
            try:
                client = AsyncOpenAI(api_key=self._settings.nvidia_api_key, base_url=self._settings.nvidia_base_url)
                resp = await client.chat.completions.create(
                    model=self._settings.nvidia_video_model,
                    messages=messages, # type: ignore
                    max_tokens=1024
                )
                return resp.choices[0].message.content or ""
            except Exception as e:
                log.error("video_summarization_failed", error=str(e))
                return f"Failed to generate video summary. Transcript: {transcript}"
