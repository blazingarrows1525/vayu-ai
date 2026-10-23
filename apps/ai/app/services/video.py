"""Video Intelligence Service."""

from __future__ import annotations

import base64
import tempfile
from pathlib import Path

import structlog
from openai import AsyncOpenAI

from app.core.config import Settings
from app.services import gemini
from app.services.ffmpeg import run_ffmpeg, safe_upload_path
from app.services.voice import VoiceService

log = structlog.get_logger(__name__)


class VideoProcessingError(RuntimeError):
    """The video could not be decoded or summarized."""


class VideoService:
    """Handles video processing: keyframe extraction, audio transcription, and summarization."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def available(self) -> bool:
        return self.provider is not None

    @property
    def provider(self) -> str | None:
        """Vision model provider: NVIDIA when configured, else Gemini."""
        if self._settings.nvidia_api_key:
            return "nvidia"
        if self._settings.gemini_api_key:
            return "gemini"
        return None

    def _vision(self) -> tuple[AsyncOpenAI, str]:
        if self.provider == "nvidia":
            client = AsyncOpenAI(
                api_key=self._settings.nvidia_api_key, base_url=self._settings.nvidia_base_url
            )
            return client, self._settings.nvidia_video_model
        return gemini.openai_client(self._settings), self._settings.gemini_media_model

    async def summarize_video(
        self,
        video_bytes: bytes,
        filename: str,
        voice_service: VoiceService
    ) -> str:
        """Process a video file to generate a summary. Raises VideoProcessingError."""
        # This is a CPU intensive task, should be run in a background worker in a real system.

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            video_path = safe_upload_path(tmp_path, filename)
            video_path.write_bytes(video_bytes)

            audio_path = tmp_path / "audio.wav"

            # 1. Extract audio (a silent video legitimately produces none)
            await run_ffmpeg(
                video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                str(audio_path),
            )

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
            await run_ffmpeg(video_path, "-vf", "fps=1/10", f"{frames_dir}/frame_%03d.jpg")

            frame_files = sorted(frames_dir.glob("*.jpg"))
            if not frame_files and not audio_path.exists():
                raise VideoProcessingError("Could not decode the uploaded video.")
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
                client, model = self._vision()
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages, # type: ignore
                    max_tokens=1024
                )
            except Exception as e:
                log.error("video_summarization_failed", provider=self.provider, error=str(e))
                raise VideoProcessingError("The vision model could not summarize this video.") from e
            summary = resp.choices[0].message.content or ""
            if not summary.strip():
                raise VideoProcessingError("The vision model returned an empty summary.")
            return summary
