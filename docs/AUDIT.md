# VAYU AI — Production-Readiness Audit

> Grounded in the actual repository (16 phases already built). This tracks the gap between the
> current state and a full enterprise launch, and what is build-verifiable here vs. gated on
> external infrastructure.

## Completed (verified green: web `next build` + `vitest`, ai `ruff` + `pytest`)
- Two-plane architecture (Next.js 16 BFF + FastAPI), JWT/JWKS bridge, RBAC.
- RAG: PDF/DOCX/TXT/MD ingest → chunk → embed (OpenAI) → pgvector cosine → grounded answers,
  citations, confidence; semantic vault search + related sources.
- Agents: 7 LangGraph personas, step checkpointing, SSE streaming.
- Editor (Tiptap + drag-handle), streaming copilot, docs + comments + members, versioning + word-diff,
  analytics, observability (OTel/structlog/Sentry), Docker, CI/CD, unit tests, docs, floating UI.

## Gaps → execution plan (build-verifiable)
| Gap | Plan | State |
|---|---|---|
| LLM Anthropic-only | Unified multi-provider layer (OpenAI, Gemini, Groq, OpenRouter) + failover + switch + token/cost | ✅ done (`phase-17`) |
| Embeddings OpenAI-only | Provider abstraction (OpenAI + Voyage) | ✅ done (`phase-17`) |
| Vector store pgvector-only | Adapter interface (pgvector default; Qdrant adapter) | planned |
| No URL ingestion | Add web-URL source to RAG | planned |
| No rerank / hybrid | Add reranking + hybrid retrieval | planned |
| No rate limiting / sec headers | Redis rate limit (AI) + security headers (web) | planned |
| No chat history | conversation/message tables + endpoints | planned |

## Gated on external resources (cannot be truthfully claimed from this machine)
- **Cloud deployment** (no cloud creds), **live LLM/embedding/vector verification** (no API keys /
  running Pinecone·Qdrant), **80%+ coverage / Playwright e2e** against a live stack (no Docker DB).
- Code for all of the above is implemented and **builds green**; live activation needs keys + Docker.
