"""Gemini for the media and embedding paths (chat goes through llm.py).

Transcription and video understanding use Gemini's OpenAI-compatible endpoint (audio and image
content parts); speech synthesis and embeddings use the native REST API, which is the only one
that exposes them.
"""

from __future__ import annotations

import base64
import io
import re
import wave

import httpx
from openai import AsyncOpenAI

from app.core.config import Settings

OPENAI_COMPAT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/"
REST_BASE = "https://generativelanguage.googleapis.com/v1beta"
_EMBED_BATCH = 100  # batchEmbedContents request limit

_TRANSCRIBE_PROMPT = (
    "Transcribe the speech in this audio verbatim, in its original language. "
    "Reply with the transcript only: no labels, timestamps or commentary. "
    "If there is no intelligible speech, reply with nothing."
)


def openai_client(settings: Settings) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.gemini_api_key,
        base_url=OPENAI_COMPAT_BASE,
        max_retries=settings.llm_max_retries,
    )


async def transcribe_mp3(settings: Settings, mp3: bytes) -> str:
    resp = await openai_client(settings).chat.completions.create(
        model=settings.gemini_media_model,
        temperature=0,
        messages=[{  # type: ignore[list-item]
            "role": "user",
            "content": [
                {"type": "text", "text": _TRANSCRIBE_PROMPT},
                {
                    "type": "input_audio",
                    "input_audio": {"data": base64.b64encode(mp3).decode(), "format": "mp3"},
                },
            ],
        }],
    )
    return (resp.choices[0].message.content or "").strip()


def pcm_to_wav(pcm: bytes, rate: int) -> bytes:
    """Wrap raw 16-bit mono PCM (what Gemini TTS returns) in a WAV container."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


async def synthesize(settings: Settings, text: str) -> bytes:
    """Text-to-speech as WAV bytes."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{REST_BASE}/models/{settings.gemini_tts_model}:generateContent",
            headers={"x-goog-api-key": settings.gemini_api_key or ""},
            json={
                "contents": [{"parts": [{"text": text}]}],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {"voiceName": settings.gemini_tts_voice}
                        }
                    },
                },
            },
        )
        resp.raise_for_status()
    inline = resp.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
    match = re.search(r"rate=(\d+)", inline.get("mimeType", ""))
    return pcm_to_wav(base64.b64decode(inline["data"]), int(match.group(1)) if match else 24000)


async def embed(settings: Settings, texts: list[str]) -> list[list[float]]:
    """Embeddings sized to `embedding_dim` (gemini-embedding-001 supports any size ≤ 3072)."""
    model = settings.gemini_embed_model
    vectors: list[list[float]] = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for start in range(0, len(texts), _EMBED_BATCH):
            batch = texts[start : start + _EMBED_BATCH]
            resp = await client.post(
                f"{REST_BASE}/models/{model}:batchEmbedContents",
                headers={"x-goog-api-key": settings.gemini_api_key or ""},
                json={
                    "requests": [
                        {
                            "model": f"models/{model}",
                            "content": {"parts": [{"text": text}]},
                            "outputDimensionality": settings.embedding_dim,
                        }
                        for text in batch
                    ]
                },
            )
            resp.raise_for_status()
            vectors.extend(item["values"] for item in resp.json()["embeddings"])
    return vectors
