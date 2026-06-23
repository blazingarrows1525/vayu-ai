# Phase 19 — Enterprise RAG: hybrid search, MMR rerank, context compression

**Status:** ✅ Complete (build-verified)

## Goal
Upgrade retrieval from pure vector search to an enterprise pipeline: hybrid (vector + keyword)
candidate generation, reranking for diversity, and context compression before grounding.

## Delivered
- **`rag/retrieval.py`** — pure, unit-tested algorithms (no DB):
  - `reciprocal_rank_fusion` — combines vector + keyword rankings without score normalization.
  - `mmr_rerank` — Maximal Marginal Relevance: relevance-to-query traded against diversity vs.
    already-selected chunks (kills near-duplicate context).
  - `compress` — dedupe near-identical chunks + cap total context to a char budget.
  - `cosine` — used for MMR + per-citation confidence.
- **`rag/pipeline.py`**:
  - `keyword_search` — Postgres full-text search (`to_tsvector`/`plainto_tsquery`/`ts_rank`).
  - `hybrid_retrieve` — vector + keyword candidates → RRF → MMR rerank (pool = 3×top_k).
  - `answer_question` rewritten: hybrid retrieve → **compress** → ground; confidence + citation
    scores now come from query↔chunk cosine over the *used* (compressed) set; `retrieval.mode`
    reports `hybrid+mmr` vs `vector`.
- **Config:** `rag_hybrid` (default on), `rag_max_context_chars` (6000).

## Reason
Pure ANN misses exact-term matches and returns redundant neighbors. Hybrid + RRF improves
recall on keyword-heavy queries; MMR improves answer quality by diversifying context; compression
controls token spend and reduces "lost in the middle."

## Validation
- `ruff` clean; **`pytest` 25 pass** (+4: cosine bounds, RRF cross-list agreement, MMR
  relevance-then-diversity, compress dedupe+budget).
- Gated on DB: the FTS + vector queries need Postgres/pgvector at runtime; the ranking/fusion/
  compression logic is fully verified here.
- Note: production should add a generated `tsvector` column + GIN index (FTS is computed on the
  fly for portability).
