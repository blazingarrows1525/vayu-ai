<div align="center">

# VAYU AI

### Intelligence at the speed of thought.

An AI-native workspace that fuses a **Notion-grade editor**, a **Perplexity-style research
engine**, and a fleet of **LangGraph agents** into one product.

`Next.js 16` · `React 19` · `FastAPI` · `PostgreSQL + pgvector` · `Redis` · `LangGraph` · `Better Auth`

</div>

---

## What it is

VAYU AI is a single surface to **write, research, reason, and remember** — built as a
production-grade, two-plane polyglot system, not a toy. It is the reference implementation
for an enterprise AI SaaS: streaming copilots, grounded RAG with citations, agentic
workflows, multi-tenant RBAC, version control for documents, and full observability.

## Architecture at a glance

```
Browser ─▶ Next.js 16 (UI + BFF) ──Drizzle──▶ ┌ Postgres + pgvector ┐ ◀──SQLAlchemy── FastAPI (RAG, agents)
                │  Better Auth (JWT+JWKS)       └──────── Redis ──────┘                 │  LangGraph, streaming
                └───────────── Bearer JWT (verified via JWKS) ─────────────────────────┘
```

- **Product plane (TypeScript):** Next.js App Router as UI **and** BFF — auth, workspaces,
  documents, the editor, collaboration.
- **Intelligence plane (Python):** FastAPI — embeddings, RAG, LangGraph agents, AI streaming.
- **Bridge:** a stateless JWT minted by Better Auth and verified by FastAPI via JWKS. Each
  plane is independently scalable; the boundary is HTTP + JWT.

Full design: **[`docs/architecture`](docs/architecture/README.md)** — overview, HLD, data
model (ERD), API design, and folder structure.

## Monorepo layout

```
apps/web      Next.js 16 — UI + BFF (product plane)
apps/ai       FastAPI — RAG + LangGraph agents (intelligence plane, managed by uv)
packages/db   Drizzle schema + client — product-plane source of truth
packages/*    ui · editor · contracts · config  (built out across phases)
infra/docker  Postgres+pgvector · Redis · MinIO (one `compose up`)
docs/         architecture & system-design deliverables
```

## Quickstart

> Prereqs: Node ≥ 20, [pnpm](https://pnpm.io) 9, [uv](https://docs.astral.sh/uv/), and Docker
> (for the local data tier).

```bash
# 1. Install JS deps (monorepo) and Python deps (ai plane)
pnpm install
uv sync --directory apps/ai

# 2. Boot the data tier (Postgres+pgvector, Redis, MinIO)
pnpm infra:up

# 3. Apply the product-plane schema
cp .env.example .env
pnpm db:migrate

# 4. Run both planes
pnpm dev          # Next.js  → http://localhost:3000
pnpm ai:dev       # FastAPI  → http://localhost:8787  (docs at /docs)
```

## Build phases

Architecture & scaffold → setup → **auth** → **editor** → **copilot** → **RAG** →
**agents** → knowledge vault → workspaces → versioning/analytics → observability →
CI/CD → testing → docs. Progress is tracked phase-by-phase; each phase ships with an
architecture rationale and interview discussion notes.

## License

Proprietary — portfolio project.
