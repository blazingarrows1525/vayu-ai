"""Embeddings via OpenAI (Anthropic has no embeddings endpoint). Degrades
gracefully when no key is configured."""

from __future__ import annotations

from openai import AsyncOpenAI

from app.core.config import Settings


class EmbeddingUnavailable(RuntimeError):
    pass


class Embedder:
    def __init__(self, settings: Settings) -> None:
        self._client = (
            AsyncOpenAI(api_key=settings.openai_api_key)
            if settings.openai_api_key
            else None
        )
        self._model = settings.embedding_model

    @property
    def available(self) -> bool:
        return self._client is not None

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if self._client is None:
            raise EmbeddingUnavailable("OPENAI_API_KEY is not configured")
        resp = await self._client.embeddings.create(model=self._model, input=texts)
        return [item.embedding for item in resp.data]

    async def embed_one(self, text: str) -> list[float]:
        return (await self.embed([text]))[0]
