# Phase 2 — Setup: Install, Boot, Verify

**Status:** ✅ Complete · Commit `e9c68af`

## Goal
Install dependencies, boot both planes, and prove they run.

## What happened
- Installed pnpm 9 globally; `pnpm install` → 173 packages (Next 16, React 19, Tailwind v4,
  Drizzle, Turbo).
- `uv sync` for the AI plane; FastAPI booted on `:8787`.
- Next.js dev booted; landing page served **HTTP 200** with the themed UI.

## Verification
- `GET /v1/health` → `{"status":"ok","plane":"intelligence"}`.
- Auth-gated AI routes → **401** without a JWT (JWKS verify wired, dev-bypass off by default).
- `pytest` → green.
- Web landing page renders (200, themed, Tailwind v4 tokens present).

## Gotchas
- Docker is **not** installed on the build machine → the data tier (Postgres/Redis/MinIO) and
  migrations are deferred; everything else verifies without it.
- Fixed `next.config` warning by moving `typedRoutes` out of `experimental` (Next 16).
