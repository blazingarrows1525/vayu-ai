"""Embeddings provider abstraction: OpenAI, Voyage AI, NVIDIA and Gemini behind one interface.

Note: providers emit different vector dimensions (OpenAI text-embedding-3-small = 1536,
voyage-3 = 1024); Gemini is asked for exactly `embedding_dim`. The pgvector column is fixed at
`embedding_dim`; switching providers requires re-indexing with a matching dimension. If the
configured provider has no key but GEMINI_API_KEY is set, Gemini is used. Degrades gracefully
when no key is configured at all.
"""

from __future__ import annotations

import httpx
from openai import AsyncOpenAI

from app.core.config import Settings
from app.services import gemini

_KEY_ENV = {
    "voyage": "VOYAGE_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
}


class EmbeddingUnavailable(RuntimeError):
    pass


def _has_key(settings: Settings, provider: str) -> bool:
    if provider == "voyage":
        return bool(settings.voyage_api_key)
    if provider == "nvidia":
        return bool(settings.nvidia_embed_api_key or settings.nvidia_api_key)
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    return bool(settings.openai_api_key)


class Embedder:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        provider = settings.embedding_provider if settings.embedding_provider in _KEY_ENV else "openai"
        if not _has_key(settings, provider) and settings.gemini_api_key:
            provider = "gemini"
        self._provider = provider
        self._available = _has_key(settings, provider)
        self._client: AsyncOpenAI | None = None

        if provider == "voyage":
            self._model = settings.voyage_model
        elif provider == "gemini":
            self._model = settings.gemini_embed_model
        elif provider == "nvidia":
            api_key = settings.nvidia_embed_api_key or settings.nvidia_api_key
            if api_key:
                self._client = AsyncOpenAI(api_key=api_key, base_url=settings.nvidia_base_url)
            self._model = settings.nvidia_embed_model
        else:  # openai
            if settings.openai_api_key:
                self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            self._model = settings.embedding_model

    @property
    def available(self) -> bool:
        return self._available

    @property
    def provider(self) -> str:
        return self._provider

    @property
    def active_model(self) -> str:
        """The embedding model actually in use (provider-aware)."""
        return self._model

    @property
    def key_env(self) -> str:
        """Env var that supplies this provider's API key (for setup hints)."""
        return _KEY_ENV[self._provider]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not self._available:
            raise EmbeddingUnavailable(
                f"{self._provider} embedding key is not configured"
            )
        if self._provider == "voyage":
            return await self._embed_voyage(texts)
        if self._provider == "gemini":
            return await gemini.embed(self._settings, texts)
        resp = await self._client.embeddings.create(model=self._model, input=texts)  # type: ignore[union-attr]
        return [item.embedding for item in resp.data]

    async def _embed_voyage(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.voyageai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {self._settings.voyage_api_key}"},
                json={"model": self._model, "input": texts},
            )
            resp.raise_for_status()
            return [item["embedding"] for item in resp.json()["data"]]

    async def embed_one(self, text: str) -> list[float]:
        return (await self.embed([text]))[0]
