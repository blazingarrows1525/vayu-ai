<div align="center">

# VAYU AI

### Intelligence at the speed of thought.

An AI-native workspace that fuses a **Notion-grade editor**, a **Perplexity-style research
engine**, and a fleet of **LangGraph agents** into one product.

`Next.js 16` · `React 19` · `FastAPI` · `PostgreSQL + pgvector` · `Redis` · `LangGraph` · `Better Auth` · `OpenTelemetry`

</div>

---

## What it is

VAYU AI is a production-grade, **two-plane polyglot** system: a TypeScript **product plane**
(Next.js as UI + BFF) and a Python **intelligence plane** (FastAPI for RAG + agents), sharing
one Postgres and one Redis, bridged by a stateless JWT verified via JWKS.

```
Browser ─▶ Next.js 16 (UI + BFF) ──Drizzle──▶ ┌ Postgres + pgvector ┐ ◀─SQLAlchemy─ FastAPI (RAG, agents)
                │  Better Auth (JWT + JWKS)     └──────── Redis ──────┘                │  LangGraph, streaming
                └───────────── Bearer JWT (verified via JWKS) ─────────────────────────┘
```

Design docs: **[`docs/architecture`](docs/architecture/README.md)**. Build reasoning + resume
guide: **[`docs/LOGIC.md`](docs/LOGIC.md)**. Per-phase log: **[`docs/build-log`](docs/build-log/README.md)**.

## Features (28 build phases — see [`docs/build-log`](docs/build-log/README.md))

| Module | Surface | Highlights |
|---|---|---|
| Auth & RBAC | `/login` `/signup` `/dashboard` | Better Auth, JWT+JWKS bridge, workspace roles (owner→viewer) |
| Editor | `/editor`, `/docs/[id]` | Tiptap: slash menu, tables, code, **math (KaTeX)**, **Mermaid**, callouts, task lists |
| AI Copilot | editor panel · `/api/ai/copilot` | Streaming, Gemini-first multi-provider (Gemini · Groq · NVIDIA · OpenAI · OpenRouter · Anthropic) with cheapest-first failover, 12 commands, usage ledger, idempotency |
| Research / RAG | `/research` | upload → chunk → embed (pgvector) → grounded answers + citations + confidence |
| Agents | `/agents` | 7 LangGraph agents — ReAct tool-calling loop (Wikipedia, calculator), step trace, SSE streaming |
| VAYU Live | `/live` | realtime voice + text over a WebSocket — streaming replies, spoken answers, barge-in, and an audio-reactive 3D voice core |
| Voice & Video | `/voice` `/media` | push-to-talk assistant (STT → safety → LLM → TTS), video summaries (keyframes + transcript) feed RAG |
| Knowledge Vault | `/vault` | semantic search, related-content (graph edges), saved searches |
| Collaboration | `/docs` `/settings/members` | documents, threaded comments + mentions, member/role management |
| Versioning + Analytics | doc History · `/analytics` | snapshots/restore/timeline; words, reading time, AI usage |
| Observability | — | OTel tracing both planes, structlog/pino, Sentry, request-id propagation |
| DevOps | `infra/`, `.github/` | Dockerfiles (Next standalone + uv), CI (build/lint/test) + CD |

## Monorepo layout

```
apps/web        Next.js 16 — UI + BFF (product plane)
apps/ai         FastAPI — RAG + LangGraph agents (intelligence plane, uv)
packages/db     Drizzle schema (product tables) + client
packages/editor @vayu/editor — Tiptap editor + extensions
infra/docker    compose (Postgres+pgvector, Redis, MinIO) + Dockerfiles
docs/           architecture, build-log, LOGIC.md
```

## Quickstart

> Prereqs: Node ≥ 20, [pnpm](https://pnpm.io) 9, [uv](https://docs.astral.sh/uv/), Docker.

```bash
pnpm install
uv --directory apps/ai sync

pnpm infra:up                                   # Postgres+pgvector, Redis, MinIO
cp .env.example .env                            # fill in keys (see below)
pnpm db:migrate                                 # product schema (Drizzle)
uv --directory apps/ai run alembic upgrade head # AI schema (pgvector)

pnpm dev        # web  → http://localhost:3000
pnpm ai:dev     # API  → http://localhost:8787  (/docs)
```

**Keys** (optional — features degrade gracefully without them): `GEMINI_API_KEY` (the default
LLM — copilot, agents, RAG grounding, voice, Live; any other provider key also works); an embeddings key for RAG (`EMBEDDING_PROVIDER`: NVIDIA in
`.env.example`, or OpenAI / Voyage); `NVIDIA_API_KEY` for voice STT + video, `OPENAI_API_KEY`
for spoken replies. Full reference: [`docs/PROVIDERS.md`](docs/PROVIDERS.md).

## Verify

```bash
pnpm -C apps/web build               # typecheck + route generation
pnpm -C apps/web test                # vitest
uv --directory apps/ai run ruff check .
uv --directory apps/ai run pytest -q
```

## Deploy

See **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — Vercel (web), Railway/ECS (AI container),
Neon/Supabase (Postgres+pgvector), Upstash (Redis), S3/R2 (storage).

## License

Proprietary — portfolio project.
