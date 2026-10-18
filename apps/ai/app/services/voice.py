"""Voice Service (STT and TTS) utilizing NVIDIA/OpenAI APIs."""

from __future__ import annotations

import structlog
from openai import AsyncOpenAI

from app.core.config import Settings

log = structlog.get_logger(__name__)


class VoiceService:
    """Handles Speech-to-Text (STT) and Text-to-Speech (TTS)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: AsyncOpenAI | None
        # Prefer NVIDIA if configured, else fallback to OpenAI for Voice
        if settings.nvidia_api_key:
            self._client = AsyncOpenAI(
                api_key=settings.nvidia_api_key, base_url=settings.nvidia_base_url
            )
            self._model = settings.nvidia_voice_model
            self._provider = "nvidia"
        elif settings.openai_api_key:
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            self._model = "whisper-1"
            self._provider = "openai"
        else:
            self._client = None
            self._model = ""
            self._provider = "none"

        # TTS prefers OpenAI's speech endpoint (known-good); otherwise it tries the STT
        # client. Callers treat synthesis as best-effort and fall back to text-only replies.
        if settings.openai_api_key:
            self._tts_client: AsyncOpenAI | None = (
                self._client if self._provider == "openai"
                else AsyncOpenAI(api_key=settings.openai_api_key)
            )
            self._tts_model = "tts-1"
        else:
            self._tts_client = self._client
            self._tts_model = "nvidia/tts" if self._provider == "nvidia" else ""

    @property
    def available(self) -> bool:
        return self._client is not None

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
        """Transcribe an audio file to text."""
        if not self._client and self._provider != "nvidia":
            raise ValueError("Voice service not configured (no API key).")
        
        try:
            if self._provider == "nvidia":
                import asyncio
                import tempfile
                from pathlib import Path

                import riva.client

                from app.services.ffmpeg import run_ffmpeg, safe_upload_path

                # Convert incoming audio (often webm from browser) to 16kHz mono WAV for Riva
                with tempfile.TemporaryDirectory() as tmpdir:
                    in_path = safe_upload_path(Path(tmpdir), filename)
                    in_path.write_bytes(audio_bytes)
                    out_path = Path(tmpdir) / "out.wav"

                    ok = await run_ffmpeg(
                        in_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                        str(out_path),
                    )
                    if not ok or not out_path.exists():
                        raise RuntimeError("Failed to convert audio for Riva via ffmpeg.")
                    wav_bytes = out_path.read_bytes()

                # Build Riva Client
                auth = riva.client.Auth(
                    uri="grpc.nvcf.nvidia.com:443", 
                    use_ssl=True, 
                    metadata_args=[
                        ["function-id", "71203149-d3b7-4460-8231-1be2543a1fca"],
                        ["authorization", f"Bearer {self._settings.nvidia_api_key}"]
                    ]
                )
                asr_service = riva.client.ASRService(auth)
                config = riva.client.RecognitionConfig(
                    encoding=riva.client.AudioEncoding.LINEAR_PCM,
                    sample_rate_hertz=16000,
                    audio_channel_count=1,
                    language_code="en-US",
                )
                
                # Run synchronous gRPC call in thread pool
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None, 
                    lambda: asr_service.offline_recognize(wav_bytes, config)
                )
                
                if not response.results:
                    return ""
                return response.results[0].alternatives[0].transcript
            
            else:
                # OpenAI fallback
                file_tuple = (filename, audio_bytes)
                resp = await self._client.audio.transcriptions.create( # type: ignore
                    model=self._model,
                    file=file_tuple,
                )
                return resp.text
        except Exception as exc:
            log.error("voice_transcription_failed", provider=self._provider, error=str(exc))
            raise

    @property
    def tts_available(self) -> bool:
        return self._tts_client is not None

    async def synthesize(self, text: str, voice: str = "alloy") -> bytes:
        """Convert text to speech (TTS) as WAV bytes via an OpenAI-compatible
        /audio/speech endpoint. Raises on failure — callers degrade to text-only."""
        if not self._tts_client:
            raise ValueError("Text-to-speech not configured.")

        try:
            resp = await self._tts_client.audio.speech.create(
                model=self._tts_model,
                voice=voice,
                input=text,
                response_format="wav",
            )
            return resp.read()
        except Exception as exc:
            log.error("voice_synthesis_failed", provider=self._provider, error=str(exc))
            raise
