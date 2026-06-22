# Phase 1 — Architecture & Project Foundation

**Status:** ✅ Complete · Commit `e9c68af` (Phases 1–3 baseline)

## Goal
Establish the architecture and a coherent monorepo scaffold.

## Key decisions
- **Two-plane polyglot** architecture (see [LOGIC.md §2](../LOGIC.md)): Next.js BFF + FastAPI,
  bridged by a stateless JWT, over one Postgres + one Redis.
- Monorepo: **pnpm + Turborepo** for TS; the Python AI app lives in the same repo, managed by
  **uv**.
- One Postgres; product tables (Drizzle) vs AI tables (SQLAlchemy) split by ownership.

## Files
- `docs/architecture/` — overview, HLD (mermaid), data model (ERD), API design, folder structure.
- Root config: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`,
  `.env.example`, `.gitignore`, `.gitattributes`, `README.md`.
- `packages/db` — full product schema as Drizzle (16 tables) + client + drizzle.config.
- `infra/docker/docker-compose.yml` (+ pgvector init SQL).
- `apps/ai` — FastAPI skeleton (config, JWKS security, health/copilot/rag/agents stubs).
- `apps/web` — Next.js 16 + Tailwind v4 landing page wired to `@vayu/db`.

## Verification
- `drizzle-kit generate` → 16-table migration emitted (schema valid).
- Files reviewed for coherence; no install yet (that's Phase 2).

## Resume notes
Architecture docs are the contract. If changing topology, update `docs/architecture/01-overview.md`.
