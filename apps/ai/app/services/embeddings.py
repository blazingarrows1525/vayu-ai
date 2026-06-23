"""Embeddings provider abstraction. OpenAI (default) and Voyage AI behind one interface.

Note: providers emit different vector dimensions (OpenAI text-embedding-3-small = 1536,
voyage-3 = 1024). The pgvector column is fixed at `embedding_dim`; switching providers requires
re-indexing with a matching dimension. Degrades gracefully when no key is configured.
"""

from __future__ import annotations

import httpx
from openai import AsyncOpenAI

from app.core.config import Settings


class EmbeddingUnavailable(RuntimeError):
    pass


class Embedder:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._provider = settings.embedding_provider
        if self._provider == "voyage":
            self._client = None
            self._model = settings.voyage_model
            self._available = bool(settings.voyage_api_key)
        else:  # openai
            self._client = (
                AsyncOpenAI(api_key=settings.openai_api_key)
                if settings.openai_api_key
                else None
            )
            self._model = settings.embedding_model
            self._available = self._client is not None

    @property
    def available(self) -> bool:
        return self._available

    @property
    def active_model(self) -> str:
        """The embedding model actually in use (provider-aware)."""
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not self._available:
            raise EmbeddingUnavailable(
                f"{self._provider} embedding key is not configured"
            )
        if self._provider == "voyage":
            return await self._embed_voyage(texts)
        resp = await self._client.embeddings.create(model=self._model, input=texts)
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
