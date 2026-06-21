# VAYU AI — Repository & Folder Structure

A **pnpm + Turborepo** monorepo for the TypeScript world, with the Python AI service living
inside it as a first-class app (managed by **uv**). One `docker-compose up` boots the whole
system locally.

```
vayu-ai/
├── apps/
│   ├── web/                      # Next.js 16 — UI + BFF (product plane)
│   │   ├── app/                  #   App Router: routes, layouts, RSC, route handlers
│   │   │   ├── (marketing)/      #   public landing
│   │   │   ├── (app)/            #   authenticated workspace shell
│   │   │   └── api/              #   BFF route handlers (auth, documents, ai proxy)
│   │   ├── components/           #   app-specific composition (uses @vayu/ui, @vayu/editor)
│   │   ├── lib/                  #   auth client, db client, server actions, fetchers
│   │   └── styles/
│   └── ai/                       # FastAPI — intelligence plane (managed by uv)
│       ├── app/
│       │   ├── main.py           #   ASGI app, router mount, middleware, OTel
│       │   ├── core/             #   config, security (JWKS verify), logging, redis
│       │   ├── api/v1/           #   copilot, rag, knowledge, agents, health routers
│       │   ├── rag/              #   parse, chunk, embed, retrieve, ground
│       │   ├── agents/           #   LangGraph graphs, tools, checkpoints
│       │   ├── db/               #   SQLAlchemy models + Alembic migrations (ai tables)
│       │   └── services/         #   LLM provider clients, S3, queue
│       ├── tests/
│       └── pyproject.toml
│
├── packages/                     # shared TypeScript packages
│   ├── db/                       # Drizzle schema + client (product tables) — source of truth
│   ├── editor/                   # Tiptap editor + custom extensions (Module 1)
│   ├── ui/                       # ShadCN-based component library (design system)
│   ├── contracts/                # zod schemas + generated typed client for the AI API
│   └── config/                   # shared tsconfig, eslint, tailwind, prettier presets
│
├── infra/
│   ├── docker/                   # Dockerfiles + docker-compose (postgres+pgvector, redis)
│   └── github/                   # reusable CI/CD workflow fragments
│
├── docs/
│   └── architecture/             # the documents you are reading
│
├── .github/workflows/            # CI (lint, typecheck, test) + CD
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                  # root scripts orchestrating turbo + the ai service
├── tsconfig.base.json
├── .env.example
└── README.md
```

## Rationale

- **`apps` vs `packages`.** Apps are deployable units (web, ai). Packages are shared,
  versioned libraries consumed by apps. The editor and design system are packages because
  they're reusable and independently testable — and it forces clean boundaries.
- **`packages/db` is the single source of truth for product schema.** Both the web app and
  any future TS service import the same Drizzle schema and inferred types. The AI plane owns
  its own tables (in `apps/ai/app/db`) — no shared DDL across languages.
- **`packages/contracts`** holds zod request/response schemas and the **generated** typed
  client for the FastAPI surface, so the BFF calls the AI plane with full type safety and the
  contract can't silently drift.
- **The Python app lives in the monorepo** (not a separate repo) so one checkout, one compose
  file, and one CI pipeline cover the whole system — while still being independently
  deployable because its boundary is HTTP + JWT.
- **Turborepo** gives cached, parallel `lint/typecheck/test/build` across packages; the AI
  service is wired in as an external task so `pnpm test` runs Python tests too.
