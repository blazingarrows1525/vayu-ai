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
| `OPENAI_API_KEY` | ai | embeddings (`text-embedding-3-small`) |
| `S3_*` | ai | object storage |
| `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | both | observability (optional) |
| `GITHUB_*`, `GOOGLE_*` | web | optional OAuth |

## The JWT/JWKS bridge in production

Better Auth (web) serves JWKS at `/api/auth/jwks`. Point the AI plane's `AUTH_JWKS_URL` at the
deployed web origin's JWKS path, and keep `AUTH_JWT_ISSUER`/`AUTH_JWT_AUDIENCE` identical on
both planes. The AI plane caches keys and refetches on rotation — no shared secret.

## Scaling notes

- Both planes are **stateless** → scale horizontally behind a load balancer.
- pgvector: start with the HNSW index (already in the migration); partition the `embedding`
  table by `workspace_id` when it gets hot.
- Long agent runs: move from the synchronous runner to a Redis-backed worker queue (the
  `agent_run.status`/`checkpoint` columns already support resume).
