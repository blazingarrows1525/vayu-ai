# Phase 12 — DevOps / CI-CD

**Status:** ✅ Complete · Commit _(this phase)_

## Goal
Containerize both planes and wire CI/CD.

## Key decisions
- **Web image**: multi-stage; Next `output: "standalone"` + `outputFileTracingRoot` (repo root)
  so the runtime image is tiny. Verified the standalone `apps/web/server.js` is emitted at the
  path the Dockerfile copies/runs.
- **AI image**: `python:3.10-slim` (matches `.python-version`) + the `uv` binary; deps installed
  from the lockfile first (cache layer) via `uv sync --frozen --no-dev`, then app source.
- **CI** (`.github/workflows/ci.yml`): web job = `pnpm install` + `next build` (typecheck +
  route gen) with dummy env; ai job = `uv sync` + `ruff check` + `pytest`.
- **CD** (`cd.yml`): manual/tagged; builds both images via buildx (push/deploy left as a
  documented wire-up to Vercel + Railway/ECS).
- Relaxed ruff `B008` (FastAPI `Depends`/`File`/`Form` + SQLAlchemy `func.now()` defaults are
  idiomatic) and `E501` (formatter's job) so the lint gate is signal, not noise.

## Files
- `infra/docker/Dockerfile.web`, `Dockerfile.ai`; root `.dockerignore`;
  `.github/workflows/{ci,cd}.yml`; `next.config.ts` (`output: standalone`);
  `apps/ai/pyproject.toml` (ruff ignore).

## Verification
- `ruff check .` → all checks pass; `pytest` 11 pass; `next build` green + standalone server
  emitted. (Docker images not built here — Docker isn't installed; Dockerfiles target the
  verified standalone layout.)
