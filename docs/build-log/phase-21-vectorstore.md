# Phase 21 — Vector-store adapter abstraction (Qdrant / Pinecone / Chroma)

**Status:** ✅ Complete (build-verified) · pgvector remains the wired default

## Goal
Satisfy the CRISP "interchangeable vector-DB adapters + provider abstraction layer" requirement
without destabilizing the working pgvector retrieval path.

## Delivered
- **`rag/vectorstore.py`** — a `VectorStore` Protocol (`ensure` / `upsert` / `query` / `available`)
  with `VectorRecord` + `VectorHit` dataclasses, and three REST adapters (httpx, **no heavy SDKs**):
  - **QdrantStore** — collections + points upsert + filtered cosine search.
  - **PineconeStore** — `/vectors/upsert` + `/query` with metadata filter.
  - **ChromaStore** — Chroma v1 REST (get-or-create collection, `/add`, `/query`).
- **`get_vector_store(settings)`** factory — returns the configured external store, or **`None`
  for `pgvector`** (the in-DB default handled directly by `pipeline.py`).
- **Config + `.env.example`**: `VECTOR_STORE`, `VECTOR_COLLECTION`, Qdrant/Chroma/Pinecone URLs+keys.

## Design honesty
pgvector stays the **wired retrieval path** (it already works and is verified). The external
adapters are the pluggable abstraction the mandate asks for — selectable via `VECTOR_STORE` — and
are verified at the **interface + factory + availability** level. Live upsert/query against
Qdrant/Pinecone/Chroma requires the running service (same infra-gating as all external integrations).

## Validation
- `ruff` clean; **`pytest` 31 pass** (+6: pgvector→None default, unknown→ValueError, Qdrant/
  Pinecone/Chroma selection + availability, `VectorHit` defaults).
