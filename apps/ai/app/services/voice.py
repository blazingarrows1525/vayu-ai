"""Voice Service: speech-to-text and text-to-speech over NVIDIA, OpenAI or Gemini."""

from __future__ import annotations

import tempfile
from pathlib import Path

import structlog
from openai import AsyncOpenAI

from app.core.config import Settings
from app.services import gemini
from app.services.ffmpeg import run_ffmpeg, safe_upload_path

log = structlog.get_logger(__name__)


async def _transcode(audio_bytes: bytes, filename: str, *output_args: str, out_name: str) -> bytes:
    """Convert untrusted uploaded audio (often browser webm) with ffmpeg."""
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = safe_upload_path(Path(tmpdir), filename)
        in_path.write_bytes(audio_bytes)
        out_path = Path(tmpdir) / out_name
        ok = await run_ffmpeg(in_path, "-vn", *output_args, str(out_path))
        if not ok or not out_path.exists():
            raise RuntimeError("Could not decode the uploaded audio.")
        return out_path.read_bytes()


class VoiceService:
    """Handles Speech-to-Text (STT) and Text-to-Speech (TTS)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: AsyncOpenAI | None = None
        self._model = ""
        # STT: dedicated ASR models first, Gemini (audio understanding) as the fallback.
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
        elif settings.gemini_api_key:
            self._model = settings.gemini_media_model
            self._provider = "gemini"
        else:
            self._provider = "none"

        # TTS: OpenAI's speech endpoint, else Gemini TTS, else the NVIDIA client. Callers treat
        # synthesis as best-effort and fall back to text-only replies.
        self._tts_client: AsyncOpenAI | None = None
        self._tts_model = ""
        if settings.openai_api_key:
            self._tts_client = (
                self._client if self._provider == "openai"
                else AsyncOpenAI(api_key=settings.openai_api_key)
            )
            self._tts_model = "tts-1"
            self._tts_provider = "openai"
        elif settings.gemini_api_key:
            self._tts_provider = "gemini"
        elif settings.nvidia_api_key:
            self._tts_client = self._client
            self._tts_model = "nvidia/tts"
            self._tts_provider = "nvidia"
        else:
            self._tts_provider = "none"

    @property
    def available(self) -> bool:
        return self._provider != "none"

    @property
    def provider(self) -> str | None:
        return None if self._provider == "none" else self._provider

    @property
    def tts_available(self) -> bool:
        return self._tts_provider != "none"

    @property
    def tts_provider(self) -> str | None:
        return None if self._tts_provider == "none" else self._tts_provider

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
        """Transcribe an audio file to text."""
        if not self.available:
            raise ValueError("Voice service not configured (no API key).")

        try:
            if self._provider == "nvidia":
                return await self._transcribe_riva(audio_bytes, filename)
            if self._provider == "gemini":
                # 32 kbps mono MP3 keeps ~80 min of audio under Gemini's 20 MB inline limit.
                mp3 = await _transcode(
                    audio_bytes, filename, "-ac", "1", "-ar", "16000", "-b:a", "32k",
                    out_name="audio.mp3",
                )
                return await gemini.transcribe_mp3(self._settings, mp3)
            resp = await self._client.audio.transcriptions.create(  # type: ignore[union-attr]
                model=self._model,
                file=(filename, audio_bytes),
            )
            return resp.text
        except Exception as exc:
            log.error("voice_transcription_failed", provider=self._provider, error=str(exc))
            raise

    async def _transcribe_riva(self, audio_bytes: bytes, filename: str) -> str:
        import asyncio

        import riva.client

        # Riva wants 16 kHz mono 16-bit PCM WAV.
        wav_bytes = await _transcode(
            audio_bytes, filename, "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            out_name="out.wav",
        )
        auth = riva.client.Auth(
            uri="grpc.nvcf.nvidia.com:443",
            use_ssl=True,
            metadata_args=[
                ["function-id", "71203149-d3b7-4460-8231-1be2543a1fca"],
                ["authorization", f"Bearer {self._settings.nvidia_api_key}"],
            ],
        )
        asr_service = riva.client.ASRService(auth)
        config = riva.client.RecognitionConfig(
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=16000,
            audio_channel_count=1,
            language_code="en-US",
        )
        # The gRPC call is synchronous — keep it off the event loop.
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None, lambda: asr_service.offline_recognize(wav_bytes, config)
        )
        if not response.results:
            return ""
        return response.results[0].alternatives[0].transcript

    async def synthesize(self, text: str, voice: str = "alloy") -> bytes:
        """Text-to-speech as WAV bytes. Raises on failure — callers degrade to text-only."""
        if not self.tts_available:
            raise ValueError("Text-to-speech not configured.")

        try:
            if self._tts_provider == "gemini":
                return await gemini.synthesize(self._settings, text)
            resp = await self._tts_client.audio.speech.create(  # type: ignore[union-attr]
                model=self._tts_model,
                voice=voice,
                input=text,
                response_format="wav",
            )
            return resp.read()
        except Exception as exc:
            log.error("voice_synthesis_failed", provider=self._tts_provider, error=str(exc))
            raise
