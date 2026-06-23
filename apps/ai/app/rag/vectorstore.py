"""Pluggable vector-store adapters behind one interface.

`pgvector` is the wired default (retrieval runs in Postgres via SQLAlchemy — see
`pipeline.py`). The external adapters (Qdrant, Chroma, Pinecone) implement the same
`VectorStore` contract over their REST APIs (httpx, no heavy SDKs) so a deployment can
swap stores via `VECTOR_STORE` config. They are verified at the build/interface level;
runtime requires the corresponding service.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.core.config import Settings


@dataclass(slots=True)
class VectorRecord:
    id: str
    vector: list[float]
    content: str
    workspace_id: str
    source_id: str
    chunk_index: int = 0
    document_id: str | None = None


@dataclass(slots=True)
class VectorHit:
    id: str
    score: float
    content: str
    source_id: str
    chunk_index: int = 0
    metadata: dict = field(default_factory=dict)


class VectorStore(Protocol):
    name: str

    @property
    def available(self) -> bool: ...

    async def ensure(self, dim: int) -> None: ...

    async def upsert(self, records: list[VectorRecord]) -> None: ...

    async def query(
        self,
        *,
        workspace_id: str,
        vector: list[float],
        top_k: int,
        source_ids: list[str] | None = None,
    ) -> list[VectorHit]: ...


def _payload(r: VectorRecord) -> dict:
    return {
        "workspace_id": r.workspace_id,
        "source_id": r.source_id,
        "chunk_index": r.chunk_index,
        "document_id": r.document_id,
        "content": r.content,
    }


class QdrantStore:
    name = "qdrant"

    def __init__(self, settings: Settings) -> None:
        self._url = (settings.qdrant_url or "").rstrip("/")
        self._key = settings.qdrant_api_key
        self._collection = settings.vector_collection

    @property
    def available(self) -> bool:
        return bool(self._url)

    def _headers(self) -> dict:
        return {"api-key": self._key} if self._key else {}

    async def ensure(self, dim: int) -> None:
        async with httpx.AsyncClient(timeout=20.0, headers=self._headers()) as c:
            await c.put(
                f"{self._url}/collections/{self._collection}",
                json={"vectors": {"size": dim, "distance": "Cosine"}},
            )

    async def upsert(self, records: list[VectorRecord]) -> None:
        points = [
            {"id": r.id, "vector": r.vector, "payload": _payload(r)} for r in records
        ]
        async with httpx.AsyncClient(timeout=30.0, headers=self._headers()) as c:
            resp = await c.put(
                f"{self._url}/collections/{self._collection}/points",
                json={"points": points},
            )
            resp.raise_for_status()

    async def query(
        self, *, workspace_id, vector, top_k, source_ids=None
    ) -> list[VectorHit]:
        must: list[dict] = [{"key": "workspace_id", "match": {"value": workspace_id}}]
        if source_ids:
            must.append({"key": "source_id", "match": {"any": source_ids}})
        body = {
            "vector": vector,
            "limit": top_k,
            "filter": {"must": must},
            "with_payload": True,
        }
        async with httpx.AsyncClient(timeout=30.0, headers=self._headers()) as c:
            resp = await c.post(
                f"{self._url}/collections/{self._collection}/points/search", json=body
            )
            resp.raise_for_status()
            return [
                VectorHit(
                    id=str(p["id"]),
                    score=float(p["score"]),
                    content=p["payload"].get("content", ""),
                    source_id=p["payload"].get("source_id", ""),
                    chunk_index=p["payload"].get("chunk_index", 0),
                    metadata=p["payload"],
                )
                for p in resp.json().get("result", [])
            ]


class PineconeStore:
    name = "pinecone"

    def __init__(self, settings: Settings) -> None:
        self._host = (settings.pinecone_index_host or "").rstrip("/")
        self._key = settings.pinecone_api_key

    @property
    def available(self) -> bool:
        return bool(self._host and self._key)

    def _headers(self) -> dict:
        return {"Api-Key": self._key or "", "content-type": "application/json"}

    async def ensure(self, dim: int) -> None:  # index is provisioned out-of-band
        return None

    async def upsert(self, records: list[VectorRecord]) -> None:
        vectors = [
            {"id": r.id, "values": r.vector, "metadata": _payload(r)} for r in records
        ]
        async with httpx.AsyncClient(timeout=30.0, headers=self._headers()) as c:
            resp = await c.post(f"{self._host}/vectors/upsert", json={"vectors": vectors})
            resp.raise_for_status()

    async def query(
        self, *, workspace_id, vector, top_k, source_ids=None
    ) -> list[VectorHit]:
        flt: dict = {"workspace_id": {"$eq": workspace_id}}
        if source_ids:
            flt["source_id"] = {"$in": source_ids}
        body = {"vector": vector, "topK": top_k, "filter": flt, "includeMetadata": True}
        async with httpx.AsyncClient(timeout=30.0, headers=self._headers()) as c:
            resp = await c.post(f"{self._host}/query", json=body)
            resp.raise_for_status()
            return [
                VectorHit(
                    id=str(m["id"]),
                    score=float(m["score"]),
                    content=(m.get("metadata") or {}).get("content", ""),
                    source_id=(m.get("metadata") or {}).get("source_id", ""),
                    chunk_index=(m.get("metadata") or {}).get("chunk_index", 0),
                    metadata=m.get("metadata") or {},
                )
                for m in resp.json().get("matches", [])
            ]


class ChromaStore:
    """Targets the Chroma v1 REST API (self-hosted)."""

    name = "chroma"

    def __init__(self, settings: Settings) -> None:
        self._url = (settings.chroma_url or "").rstrip("/")
        self._collection = settings.vector_collection
        self._cid: str | None = None

    @property
    def available(self) -> bool:
        return bool(self._url)

    async def _collection_id(self, client: httpx.AsyncClient) -> str:
        if self._cid:
            return self._cid
        resp = await client.post(
            f"{self._url}/api/v1/collections",
            json={"name": self._collection, "get_or_create": True},
        )
        resp.raise_for_status()
        self._cid = resp.json()["id"]
        return self._cid

    async def ensure(self, dim: int) -> None:
        async with httpx.AsyncClient(timeout=20.0) as c:
            await self._collection_id(c)

    async def upsert(self, records: list[VectorRecord]) -> None:
        async with httpx.AsyncClient(timeout=30.0) as c:
            cid = await self._collection_id(c)
            resp = await c.post(
                f"{self._url}/api/v1/collections/{cid}/add",
                json={
                    "ids": [r.id for r in records],
                    "embeddings": [r.vector for r in records],
                    "documents": [r.content for r in records],
                    "metadatas": [_payload(r) for r in records],
                },
            )
            resp.raise_for_status()

    async def query(
        self, *, workspace_id, vector, top_k, source_ids=None
    ) -> list[VectorHit]:
        where: dict = {"workspace_id": workspace_id}
        if source_ids:
            where = {
                "$and": [
                    {"workspace_id": workspace_id},
                    {"source_id": {"$in": source_ids}},
                ]
            }
        async with httpx.AsyncClient(timeout=30.0) as c:
            cid = await self._collection_id(c)
            resp = await c.post(
                f"{self._url}/api/v1/collections/{cid}/query",
                json={"query_embeddings": [vector], "n_results": top_k, "where": where},
            )
            resp.raise_for_status()
            data = resp.json()
            ids = (data.get("ids") or [[]])[0]
            dists = (data.get("distances") or [[]])[0]
            docs = (data.get("documents") or [[]])[0]
            metas = (data.get("metadatas") or [[]])[0]
            hits: list[VectorHit] = []
            for i, _id in enumerate(ids):
                meta = metas[i] if i < len(metas) else {}
                dist = float(dists[i]) if i < len(dists) else 1.0
                hits.append(
                    VectorHit(
                        id=str(_id),
                        score=round(max(0.0, 1.0 - dist), 4),
                        content=docs[i] if i < len(docs) else "",
                        source_id=(meta or {}).get("source_id", ""),
                        chunk_index=(meta or {}).get("chunk_index", 0),
                        metadata=meta or {},
                    )
                )
            return hits


_REGISTRY: dict[str, type] = {
    "qdrant": QdrantStore,
    "pinecone": PineconeStore,
    "chroma": ChromaStore,
}


def get_vector_store(settings: Settings) -> VectorStore | None:
    """Return the configured external store, or None when `pgvector` (the in-DB
    default handled by the pipeline) is selected."""
    name = settings.vector_store
    if name in ("", "pgvector"):
        return None
    cls = _REGISTRY.get(name)
    if cls is None:
        raise ValueError(f"unknown vector store: {name}")
    return cls(settings)
