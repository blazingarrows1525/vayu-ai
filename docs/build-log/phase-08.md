# Phase 8 — Knowledge Vault

**Status:** ✅ Complete · Commit _(this phase)_

## Goal
Semantic search across the vault, related-content recommendations, saved searches.

## Key decisions
- Reuse the Phase 6 `embedding` table (pgvector) — no new schema. Vault search is workspace-wide
  ANN; "related" is nearest *other* sources to a seed source's vector (knowledge-graph edges).
- **Saved searches** kept client-side (localStorage) for the demo — production would persist
  to a product table.

## Files
- ai: `rag/pipeline.py` — `semantic_search` (grouped-by-source) + `related_sources`;
  `api/v1/rag.py` — `POST /v1/search`, `GET /v1/knowledge/{id}/related`, `_attach_titles`.
- web: `/vault` UI (search, saved-search chips, results, per-result "find related") +
  `api/vault/{search,related}` proxies; `proxy.ts` guards `/vault`.

## Verification
- 11 ai tests pass; `next build` green (`/vault` route present).
- Build caught two real bugs (good signal): `await` inside a non-async `setState` callback;
  and `noUncheckedIndexedAccess` narrowing — fixed by binding `related[id]` to a const in the map.

## Pending (live)
Search/related need embeddings (`OPENAI_API_KEY`) + pgvector (Docker).

## Deferred
Full knowledge-graph *visualization* (results expose the edges; a force-graph view is a UI layer).
