# VAYU AI — Deployment

The two planes deploy independently; they only share Postgres + Redis and the JWT/JWKS bridge.

## Topology

| Component | Recommended host | Notes |
|---|---|---|
| Product plane (`apps/web`) | **Vercel** | Next.js 16; or any Node host via `Dockerfile.web` (standalone) |
| Intelligence plane (`apps/ai`) | **Railway / AWS ECS / Fly** | container from `infra/docker/Dockerfile.ai` |
| Postgres + pgvector | **Neon / Supabase / RDS** | must have the `vector` extension |
| Redis | **Upstash / ElastiCache** | cache, rate-limit, idempotency |
| Object storage | **S3 / Cloudflare R2 / MinIO** | document uploads |

## Build images

```bash
docker build -f infra/docker/Dockerfile.web -t vayu-web .
docker build -f infra/docker/Dockerfile.ai  -t vayu-ai  .
```

`.github/workflows/cd.yml` builds both on a tag / manual dispatch — wire the push + deploy
steps to your registry and hosts.

## CI / CD

`.github/workflows/ci.yml` runs on every push to `main` and every PR:

| Job | What it checks |
|---|---|
| **web** | `pnpm build` (Next.js typecheck + route gen) + `vitest` unit tests |
| **ai** | `uv sync --frozen` → `ruff` lint → `pytest` |
| **e2e** | Playwright against a real Postgres service — landing, auth redirect, and a full **signup → dashboard → research** journey |
| **deploy** | on a green push to `main`, fires Render deploy hooks (opt-in) |

**Wire CI-gated deploys** (so only green builds ship, instead of Render's blind auto-deploy):

1. Render dashboard → each service → Settings → *Deploy Hook* → copy the URL.
2. Repo → Settings → Secrets and variables → Actions → add `RENDER_DEPLOY_HOOK_WEB`
   and `RENDER_DEPLOY_HOOK_AI`.
3. Turn **off** Auto-Deploy on both Render services.

Without those secrets the `deploy` job is a no-op, so CI stays green whether or not you opt in.

## Migrations

```bash
pnpm db:migrate                                  # product tables (Drizzle)
uv --directory apps/ai run alembic upgrade head  # AI tables + pgvector/HNSW
```

## Environment variables

| Var | Plane | Purpose |
|---|---|---|
| `DATABASE_URL` | both | Postgres (pgvector-enabled) |
| `REDIS_URL` | both | cache / rate-limit / idempotency |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | web | auth signing + base URL |
| `AI_SERVICE_URL` | web | server-to-server URL of the AI plane |
| `AUTH_JWKS_URL`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE` | ai | verify Better Auth JWTs (`…/api/auth/jwks`) |
| `ANTHROPIC_API_KEY` | ai | copilot / agents / RAG grounding |
| `VOYAGE_API_KEY` / `OPENAI_API_KEY` | ai | embeddings — Voyage `voyage-3` (default) or OpenAI |
| `S3_*`, `MAX_UPLOAD_MB` | ai | object storage (opt-in) + upload size cap |
| `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | both | observability (optional) |
| `GITHUB_*`, `GOOGLE_*` | web | optional OAuth |

## The JWT/JWKS bridge in production

Better Auth (web) serves JWKS at `/api/auth/jwks`. Point the AI plane's `AUTH_JWKS_URL` at the
deployed web origin's JWKS path, and keep `AUTH_JWT_ISSUER`/`AUTH_JWT_AUDIENCE` identical on
both planes. The AI plane caches keys and refetches on rotation — no shared secret.

## Cold starts (free tier) & keeping warm

Render's free tier spins a service down after ~15 min idle; the next request pays a 30–60s
cold start. `.github/workflows/keepalive.yml` pings both planes every ~10 min to keep them
warm — free, external, no worker burned. It's best-effort (GitHub cron has a 5-min floor and
drifts under load, and scheduled workflows pause after 60 days of repo inactivity). For a hard
guarantee, move the two web services to a paid Render tier and delete the workflow.

Point the pinger at a different host by setting repo **Variables** `WEB_URL` / `AI_URL`
(Settings → Secrets and variables → Actions → Variables) — no file edit needed.

## Custom domain (Render)

1. **Add the domain** — Render dashboard → `vayu-web` → Settings → *Custom Domains* → add
   `app.yourdomain.com` (subdomain) or the apex `yourdomain.com`.
2. **DNS** — at your registrar, add the record Render shows: `CNAME` → `vayu-web-r6dn.onrender.com`
   for a subdomain, or an `ALIAS`/`A` record for an apex. Render auto-issues the TLS cert once
   DNS verifies (a few minutes).
3. **Re-point env** — on `vayu-web` set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to
   `https://app.yourdomain.com`; on `vayu-ai` set `AUTH_JWKS_URL` to
   `https://app.yourdomain.com/api/auth/jwks`. If you also domain the AI plane, update
   `AI_SERVICE_URL` to match. Redeploy both.
4. **Re-point keep-alive** — set the `WEB_URL` / `AI_URL` repo Variables to the new host so the
   pinger follows the domain.

## Scaling notes

- Both planes are **stateless** → scale horizontally behind a load balancer.
- pgvector: start with the HNSW index (already in the migration); partition the `embedding`
  table by `workspace_id` when it gets hot.
- Long agent runs: move from the synchronous runner to a Redis-backed worker queue (the
  `agent_run.status`/`checkpoint` columns already support resume).
