# Phase 6 — RAG / Research Command Center

**Status:** ✅ Complete · Commit `aa304db`

## Goal
Upload → parse → chunk → embed → pgvector retrieval → grounded answers with citations.

## Key decisions
- **Intelligence-plane DB** introduced: SQLAlchemy async (asyncpg) + **Alembic** migration
  (`0001_init`) creating `knowledge_source`, `embedding` (pgvector, **HNSW** index),
  `agent_run`, `agent_step`. `CREATE EXTENSION vector` in the migration.
- Pipeline: parse (pypdf / python-docx / txt / md) → paragraph chunking w/ overlap →
  embed (OpenAI `text-embedding-3-small`, 1536-dim) → store.
- Retrieval: cosine distance (`embedding <=> q`) workspace-scoped, top-k.
- Grounding: cite-constrained Anthropic completion (`provider.complete`); confidence =
  f(top similarity, coverage); citations with snippets.

## Files
- ai: `db/{base,models,migrations/*}`, `services/embeddings.py`, `rag/{parsing,chunking,pipeline}.py`,
  `api/v1/rag.py` (ingest/list/get + `/rag/ask`).
- web: `/research` UI (upload, sources, ask + citations) + `api/research/{ask,sources,upload}` proxies;
  `proxy.ts` guards `/research`.

## Verification
- 7 ai tests pass (incl. chunking/parsing units); `next build` (13 routes).

## Pending (live)
Embeddings need `OPENAI_API_KEY`; vectors/retrieval need pgvector (Docker) +
`alembic upgrade head`.
