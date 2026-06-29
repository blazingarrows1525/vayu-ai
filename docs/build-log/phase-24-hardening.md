# Phase 24 — Cold starts, RAG expansion, CI-gated deploys, UI polish

**Status:** ✅ Shipped to `main` (Render auto-rebuilds) · all four goals done · local checks green

Building on the live Render deployment (phase 23), this phase hardens operations and deepens
the product across four fronts. Everything degrades gracefully — no new required secret breaks
the existing deploy.

---

## 1 · Kill cold starts + custom domain

- **`.github/workflows/keepalive.yml`** — a scheduled GitHub Action pings the web `/` and AI
  `/v1/health` every ~10 min, resetting Render's free-tier idle timer so the next real visitor
  doesn't pay a 30–60s cold start. Free, external, no worker burned on the dyno. Targets are
  overridable via repo Variables `WEB_URL` / `AI_URL`. Best-effort (GitHub cron has a 5-min
  floor + drifts, and pauses after 60 days of repo inactivity) — for a hard guarantee, move to
  a paid tier and delete the workflow.
- **Custom domain** — step-by-step (Render custom domain → DNS CNAME/ALIAS → re-point
  `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` / `AUTH_JWKS_URL` → re-point keep-alive vars)
  documented in [DEPLOYMENT.md](../DEPLOYMENT.md#custom-domain-render). Needs your domain + DNS.

## 2 · RAG: more types, bigger files, raw-file storage

- **PPTX ingestion** (`apps/ai/app/rag/parsing.py` + `python-pptx`) — each slide's shape text,
  table cells, and speaker notes are flattened under a `# Slide N` header, so a deck is chunked
  + embedded like any other source. UI `accept` + label updated; in-memory pptx unit test added.
- **Upload size cap** — `MAX_UPLOAD_MB` (default **25**) rejects oversized uploads with HTTP 413
  before they hit the worker's memory (important on a 512MB free dyno). Enforced on the AI plane,
  mirrored by a client-side guard, and the BFF now forwards 413/415 so the UI shows a real reason.
- **Opt-in object storage** (`apps/ai/app/services/storage.py` + `boto3`) — when both `S3_*`
  credentials are set (MinIO locally, S3 / R2 / B2 in prod), the original file is persisted and
  its key recorded on `knowledge_source.storage_key` (column already existed). `GET
  /v1/knowledge/{id}/raw` returns a short-lived presigned download URL. boto3 is synchronous so
  every call runs in a worker thread, and every call is best-effort — **storage failures never
  break ingestion**, and with no creds it's a clean no-op (current prod behaviour). The research
  list shows a "saved" badge when a raw file is stored.

## 3 · CI-gated deploys + authenticated E2E

- **`ci.yml` deploy gate** — a new `deploy` job runs only on a green push to `main` and fires
  Render Deploy Hooks (`RENDER_DEPLOY_HOOK_WEB` / `_AI`). It's a **safe no-op until you opt in**
  (no secrets → skip), so it coexists with Render's current auto-deploy. To make tests truly gate
  shipping: add the two hook secrets and turn **off** Render Auto-Deploy.
- **Authenticated E2E** (`apps/web/e2e/auth.spec.ts`) — a real signup → `/dashboard` journey,
  session-survives-reload, and authenticated `/research` render. The CI `e2e` job now spins up a
  **pgvector Postgres service** + runs Drizzle migrations so these DB-backed flows execute end to
  end. The AI plane isn't required (asserts page shells, not AI output). Product schema uses core
  `gen_random_uuid()` on PG16 → no extension step needed.

## 4 · Correctness + UI polish

- **Provider-aware embeddings hint** — the RAG "embeddings not configured" message hardcoded
  `OPENAI_API_KEY`; it now names the *active* provider's key (`VOYAGE_API_KEY` in this deploy)
  via `Embedder.key_env`.
- **Agent Command Center** — Run is disabled on an empty task, a "Planning the run…" pending card
  shows between click and the first streamed step, and error frames render in a distinct red style.

---

## Verification (local, this session)

| Check | Result |
|---|---|
| `uv run ruff check .` (ai) | ✅ clean |
| `uv run pytest -q` (ai) | ✅ **32 passed** (+1 PPTX) |
| `pnpm -C apps/web build` | ✅ compiled, all routes incl. `/agents` `/research` |
| `pnpm -C apps/web test` (vitest) | ✅ 3 passed |
| `playwright test --list` | ✅ 6 tests discovered (3 auth + 3 smoke) |
| workflow YAML parse | ✅ ci / cd / keepalive |

Docker wasn't running locally, so the DB-backed e2e + MinIO storage paths are exercised by CI /
the live deploy rather than here.

## Your action items (dashboard / DNS — optional)

- **Deploy gate:** add `RENDER_DEPLOY_HOOK_WEB` / `RENDER_DEPLOY_HOOK_AI` repo secrets + disable
  Render Auto-Deploy (see [DEPLOYMENT.md](../DEPLOYMENT.md#ci--cd)).
- **Prod raw-file storage:** create an S3/R2/B2 bucket + set `S3_*` on `vayu-ai` (off by default).
- **Custom domain:** add it in Render + DNS, then re-point the URLs above.

See also: [phase-23-deploy.md](phase-23-deploy.md), [DEPLOYMENT.md](../DEPLOYMENT.md).
