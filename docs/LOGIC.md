# VAYU AI — Build Logic & Resume Guide

> **Purpose of this file:** a single, exportable source of truth that lets a fresh
> Claude Code session (or a human) understand *what* VAYU AI is, *how* it's built,
> *why* each decision was made, and *exactly where to pick up*. Read this first.

Last updated after **Phase 15** (floating UI overhaul). All core phases are complete and
committed; the build is green on both planes (web `next build` + `vitest`; ai `ruff` + `pytest`).
Live features activate with Docker (DB) + provider keys.

> **UI (Phase 15):** the app now has a "command-center" visual language — animated aurora
> background + glassmorphism + neon glow (`app/globals.css`) and a global **floating AI dock**
> (`components/floating-dock.tsx`, mounted in the root layout) with glowing, magnifying icons
> for every module. Pure CSS animations, no new deps. See `docs/build-log/phase-15-ui.md`.

> **Multi-provider LLM (Phase 17):** chat is no longer Anthropic-only. `apps/ai/app/services/llm.py`
> exposes `resolve_llm(settings, preferred)` — first *available* provider across
> `anthropic / openai / gemini / groq / openrouter` (OpenAI-compatible ones share one class via
> base-URL), with **failover + provider switching + token/cost tracking**. Embeddings abstract
> OpenAI + Voyage. Status at `GET /v1/providers`. Production-readiness tracker: `docs/AUDIT.md`.

---

## 1. What this project is

VAYU AI — "Intelligence at the speed of thought." An AI-native workspace combining a
Notion-grade editor, a Perplexity-style research engine, and a fleet of LangGraph agents.
Inspired by Novel (github.com/steven-tey/novel) but **not** a clone — a production-grade,
Staff-Engineer-level portfolio flagship.

Location: `C:\Users\ASUS\Desktop\vayu ai` (its own git repo; separate from the Kairos/Xeno
project in the sibling `xeno - j bhai` folder).

---

## 2. The one decision everything hangs on: a two-plane polyglot architecture

The spec names **Better Auth** (TypeScript) *and* **FastAPI + LangGraph** (Python). Rather
than fight that, the architecture makes it the design:

```
Browser ─▶ Next.js 16 (UI + BFF) ──Drizzle──▶ ┌ Postgres + pgvector ┐ ◀─SQLAlchemy─ FastAPI (RAG, agents)
                │  Better Auth (JWT + JWKS)     └──────── Redis ──────┘                │  LangGraph, streaming
                └───────────── Bearer JWT (verified via JWKS) ─────────────────────────┘
```

- **Product plane (TypeScript)** — Next.js App Router as UI **and** BFF: auth, workspaces,
  documents, editor, collaboration. Owns product tables via **Drizzle**.
- **Intelligence plane (Python)** — FastAPI: RAG, embeddings, LangGraph agents, streaming.
  Owns AI tables via **SQLAlchemy/Alembic**.
- **Bridge** — a stateless short-lived **JWT** minted by Better Auth and verified by FastAPI
  against its **JWKS** endpoint (`/api/auth/jwks`). The AI plane never touches the session
  store. RBAC claims (`workspace_id`, `role`) ride in the token.
- **One Postgres, one Redis** shared by both planes; table ownership split by convention,
  cross-plane references are loose UUIDs (no hard FKs across the boundary).

Full design docs: [`docs/architecture/`](architecture/README.md).

---

## 3. Tech stack (verified versions as built)

| Area | Choice |
|---|---|
| Monorepo | pnpm 9 workspaces + Turborepo 2.x |
| Web | Next.js **16.2.9** (Turbopack), React **19.2.7**, Tailwind CSS **v4**, TypeScript 5.9 |
| Editor | Tiptap **3.27.1** + lowlight, KaTeX, Mermaid |
| Auth | Better Auth **1.6.20** (JWT plugin, JWKS, UUID ids) |
| Product DB | Drizzle ORM **0.45.x** + drizzle-kit 0.31 (postgres-js) |
| AI service | FastAPI, Python 3.10, managed by **uv** |
| AI DB | SQLAlchemy 2 (async, asyncpg) + Alembic + **pgvector** |
| LLM | Anthropic SDK (streaming), default model **`claude-opus-4-8`** |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Agents | **LangGraph** state machine |
| Infra | docker-compose: Postgres+pgvector (pg16), Redis, MinIO |

Local toolchain when built: Node 25, npm 11, pnpm 9.15.9, Python 3.10.11, uv 0.11, git 2.54.
**Docker is NOT installed** on the build machine — see §6.

---

## 4. Repository layout

```
apps/web        Next.js 16 — UI + BFF (product plane)
  app/          routes: (auth) login/signup, dashboard, editor, research, agents, api/*
  lib/          auth, auth-client, session, rbac, workspace, ai (bridge), use-copilot
  components/   auth-form, copilot-panel
  proxy.ts      edge guard (Next 16's middleware successor)
apps/ai         FastAPI — RAG + LangGraph agents (intelligence plane, uv)
  app/core/     config (pydantic-settings), security (JWKS verify), prompts
  app/services/ llm (Anthropic), embeddings (OpenAI), redis, cache
  app/rag/      parsing, chunking, pipeline
  app/agents/   registry (7 agents), graph (LangGraph), runner
  app/db/       base (async engine), models, migrations (Alembic)
  app/api/v1/   health, copilot, rag, agents, router
packages/db     Drizzle schema (product tables) + client — source of truth
packages/editor @vayu/editor — Tiptap editor + extensions
infra/docker    compose + pgvector init SQL
docs/           architecture/, build-log/, LOGIC.md (this file)
```

---

## 5. How to run & verify (build machine)

```bash
pnpm install                      # JS deps
uv --directory apps/ai sync       # Python deps

# Verify (no Docker/keys needed — this is how every phase was checked):
pnpm -C apps/web build            # Next build = TS typecheck + route gen (authoritative)
uv --directory apps/ai run pytest # AI plane tests
pnpm -C packages/db exec drizzle-kit generate   # validate product schema

# Run live (needs the data tier + keys — see §6):
pnpm infra:up                     # Postgres+pgvector, Redis, MinIO (needs Docker)
pnpm db:migrate                   # product schema (Drizzle)
uv --directory apps/ai run alembic upgrade head  # AI schema (pgvector)
pnpm dev                          # web → :3000
pnpm ai:dev                       # FastAPI → :8787 (docs at /docs)
```

**Build/typecheck note:** `next build` needs a (dummy is fine) `DATABASE_URL` +
`BETTER_AUTH_SECRET` in the env because route modules import the auth/db clients at
build time. Used during the build:
`DATABASE_URL=postgresql://vayu:vayu@localhost:5432/vayu BETTER_AUTH_SECRET=<32+ chars>`.

---

## 6. External dependencies that gate *live* behavior (not the build)

Everything degrades gracefully without these — the build is always green; live features
light up when the dep is present.

| Dep | Needed for | How |
|---|---|---|
| **Docker Desktop** | the database (auth sign-up, migrations, RAG vectors, agent persistence) | `winget install Docker.DockerDesktop`, then `pnpm infra:up` |
| **ANTHROPIC_API_KEY** | real copilot/agent/RAG-grounding output | set in `.env` (default model `claude-opus-4-8`) |
| **OPENAI_API_KEY** | RAG embeddings (`text-embedding-3-small`) | set in `.env` |
| GITHUB/GOOGLE OAuth | social login (optional) | set client id/secret in `.env` |

Dev shortcut: the AI plane honors `AUTH_ALLOW_DEV_TOKEN=true` → accepts `Authorization:
Bearer dev` (workspace `…00aa`, role owner) so you can curl the AI plane without the web
plane. **Off by default** (must never be true in prod).

---

## 7. Phase status (14-phase plan)

| # | Phase | Status | Commit |
|---|---|---|---|
| 1 | Architecture & scaffold | ✅ | `e9c68af` (baseline) |
| 2 | Setup: install/boot/verify | ✅ | `e9c68af` |
| 3 | Auth & RBAC | ✅ | `e9c68af` |
| 4 | VAYU Editor (Tiptap) | ✅ | `f217e16` |
| 5 | AI Copilot | ✅ | `4290bd4` |
| 6 | RAG / Research | ✅ | `aa304db` |
| 7 | Agents (LangGraph) | ✅ | `b880e98` |
| 8 | Knowledge Vault | ✅ | `1417d44` |
| 9 | Workspaces & collaboration | ✅ | `242e24f` |
| 10 | Version control & analytics | ✅ | `7676f5c` |
| 11 | Observability | ✅ | `d25179f` |
| 12 | DevOps / CI-CD | ✅ | `3a65e89` |
| 13 | Testing | ✅ | `d03c9eb` |
| 14 | Documentation & polish | ✅ | (this commit) |

Per-phase detail: [`docs/build-log/`](build-log/README.md).

---

## 8. Hard-won gotchas (don't relearn these)

- **drizzle-orm must be ≥ 0.45** — better-auth's adapter declares it as a peer; 0.38 mismatches.
- **Next 16 renamed `middleware.ts` → `proxy.ts`** (export a function named `proxy`); the
  old convention is deprecated and warns.
- **`typedRoutes` rejects arbitrary strings** — dynamic redirect targets need a `Route` cast,
  and we restrict `?redirect=` to same-origin paths (closes an open-redirect).
- **Better Auth ids:** set `advanced.database.generateId: "uuid"` so ids match uuid columns;
  the `jwt` plugin needs a `jwks` table in the Drizzle schema.
- **Tiptap v3:** `useEditor({ immediatelyRender: false })` for Next SSR; StarterKit bundles
  codeBlock/link/underline (disable codeBlock to use CodeBlockLowlight).
- **Default LLM = `claude-opus-4-8`** (per the claude-api skill; don't downgrade for cost —
  user's call). Anthropic has no embeddings API → embeddings via OpenAI.
- **AI tables ≠ product tables.** Product schema is Drizzle (`packages/db`); AI schema is
  SQLAlchemy/Alembic (`apps/ai/app/db`). The `ai_generation` ledger is product-owned, so the
  **BFF** writes it by teeing the copilot SSE `usage` event.
- **Shared TS packages need `@types/node`** when their `tsconfig` sets `"types": ["node"]`;
  `packages/db` also uses `rootDir: "."` so `drizzle.config.ts` (at package root) typechecks.

---

## 9. How to resume in a new session

1. Read this file + [`docs/architecture/README.md`](architecture/README.md).
2. `git log --oneline` to see the last committed phase.
3. Pick the next ⬜ phase from §7; read its plan in the task list / architecture docs.
4. Build the phase, verify with the §5 commands (build must stay green), commit with a
   `feat(<area>): …` message, then update §7 + add a `docs/build-log/phase-NN.md`.
5. The session memory file `vayu-ai-project` (in Claude's auto-memory) also tracks status.
