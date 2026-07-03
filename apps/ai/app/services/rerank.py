"""NVIDIA NIM Reranking Service."""

from __future__ import annotations

import httpx
import structlog
from pydantic import BaseModel

from app.core.config import Settings

log = structlog.get_logger(__name__)


class RerankResult(BaseModel):
    index: int
    logit: float


class NVIDIAReranker:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._available = bool(settings.nvidia_api_key)

    @property
    def available(self) -> bool:
        return self._available

    @property
    def model(self) -> str:
        return self._settings.nvidia_rerank_model

    async def rerank(
        self, query: str, chunks: list[str], top_k: int
    ) -> list[int]:
        """Reranks the given chunks.
        Returns the original indices of `chunks` in the new ranked order (up to top_k).
        """
        if not self._available or not chunks:
            # Fallback to returning original indices if not configured
            return list(range(min(len(chunks), top_k)))

        try:
            passages = [{"text": chunk} for chunk in chunks]
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self._settings.nvidia_base_url}/ranking",
                    headers={"Authorization": f"Bearer {self._settings.nvidia_api_key}"},
                    json={
                        "model": self._settings.nvidia_rerank_model,
                        "query": {"text": query},
                        "passages": passages,
                        "truncate": "END",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                
                # Sort by logit descending
                rankings = [RerankResult(**item) for item in data.get("rankings", [])]
                # Rankings from NIM are already sorted usually, but we sort to be safe
                rankings.sort(key=lambda x: x.logit, reverse=True)
                
                return [r.index for r in rankings][:top_k]
        except Exception as exc:
            log.warning("nvidia_rerank_failed", error=str(exc))
            # Fallback to original order on failure
            return list(range(min(len(chunks), top_k)))
