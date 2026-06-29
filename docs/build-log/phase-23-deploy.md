# Phase 23 — Dockerized full-stack run + Render deployment

**Status:** ✅ Live in production · public URL healthy · Excel/CSV ingestion added

This phase took VAYU from "builds locally" to **running as Docker containers** and then **deployed publicly on Render**, plus added spreadsheet ingestion. Documents the *what* and the *why* (root causes) so any session can resume.

---

## Live deployment

| Piece | URL / detail |
|---|---|
| Web (product plane) | **https://vayu-web-r6dn.onrender.com** |
| AI (intelligence plane) | **https://vayu-ai-r6dn.onrender.com** (`/v1/health`, `/v1/providers`) |
| Database | Render managed Postgres + pgvector (Oregon) |
| Blueprint | `render.yaml` (2 Docker web services + 1 Postgres) |
| Repo | github.com/blazingarrows1525/vayu-ai |

**Models:** chat = `claude-sonnet-4-6` (balanced cost/quality); embeddings = **Voyage** `voyage-3` (1024-dim, free tier — OpenAI key had no quota).

**Verified working in production:** signup→session→JWT, copilot (full browser→web→AI path, real Sonnet output), RAG ingest→grounded answer with citations, and **Excel (.xlsx) upload** (tested live: a real inventory sheet answered correctly with a citation).

---

## What was done (documentation)

1. **Local Docker stack** — `infra/docker/docker-compose.prod.yml` overlays built `web` + `ai` images on the data tier. One command:
   ```
   docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d
   ```
   (Secrets loaded from root `.env` into the shell for `${...}` interpolation; inter-service URLs use Docker DNS — `postgres:5432`, `http://ai:8787`, `http://web:3000`.)
2. **Model → Sonnet 4.6** in `.env` + committed defaults (`.env.example`, `apps/ai/app/core/config.py`).
3. **Embeddings → Voyage** — re-dimensioned the `embedding` pgvector column `1536 → 1024` (local + cloud) because `voyage-3` is 1024-dim.
4. **Excel/CSV ingestion** (`apps/ai/app/rag/parsing.py` + `openpyxl`) — `.xlsx` sheets flattened to `cell | cell | cell` text rows; `.csv` decoded as text; web upload `accept` + label updated.
5. **Render deploy** via `render.yaml` Blueprint; cloud DB migrated from local against the External URL (`CREATE EXTENSION` → Drizzle → Alembic → the 1024 `ALTER`).

---

## The 3 deploy bugs fixed (logic / root causes)

These are Render(+container)-specific and non-obvious:

1. **Build broke — `next build` crashed.** Render injects service env vars as **Docker build args**; a placeholder `BETTER_AUTH_URL` reached the build and Better Auth rejected it. → `Dockerfile.web` now declares build ARGs only for build-needed vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`); runtime-only URLs are kept out of the build. (`b42f44b`)
2. **Booted but crashed at runtime.** An invalid `BETTER_AUTH_URL` threw at module load. → `apps/web/lib/auth.ts` `resolveBaseURL()` validates the URL and falls back to Render's auto `RENDER_EXTERNAL_URL` → localhost. (`1820201`)
3. **502 on every request (the killer).** Next standalone binds to `$HOSTNAME`; Render/K8s set `HOSTNAME` to the **pod name**, so the server bound to an unreachable interface. Deploy log tell: `Local: http://srv-...-hibernate-...:10000` instead of `0.0.0.0`. → `Dockerfile.web` CMD `sh -c "HOSTNAME=0.0.0.0 node apps/web/server.js"`. (`31803d3`)

Plus: **`/editor` was unguarded** → a logged-out user hit the copilot and got a confusing 401 (the BFF returns 401 only for *no session*; an AI-plane token rejection would be 502). Added `/editor` to `proxy.ts` matcher. (`450081a`)

---

## Config / env (Render dashboard)

- **Secrets (set in dashboard):** `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`. `BETTER_AUTH_SECRET` auto-generated.
- **Cross-service URLs (real values, no `<>`):** `vayu-web` → `AI_SERVICE_URL=https://vayu-ai-r6dn.onrender.com`; `vayu-ai` → `AUTH_JWKS_URL=https://vayu-web-r6dn.onrender.com/api/auth/jwks`. (`BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` now auto-resolved by the code.)
- **DB SSL from local tooling:** Alembic/asyncpg needs `?ssl=require`; psql/Drizzle use `?sslmode=require`.

## Gotchas
- **Render free tier sleeps after ~15 min idle** and **every push triggers a ~5–10 min rebuild** (AI down briefly). Both cause a transient **502 — just retry after ~30–60s.** Not a bug.
- `.env` / `apps/web/.env.local` are gitignored — never committed.

## How to redeploy
Push to `main` → Render auto-deploys (if Auto-Deploy is on). Else: service → **Manual Deploy → Clear build cache & deploy**.

See also: [DEPLOYMENT.md](../DEPLOYMENT.md), and the `vayu-*` memory files.
