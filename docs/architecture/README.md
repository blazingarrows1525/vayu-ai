# VAYU AI — Architecture

> Intelligence at the speed of thought.

| # | Document | What it covers |
|---|---|---|
| 01 | [Executive Overview](01-overview.md) | Product vision, the two-plane decision, tradeoffs, interview points |
| 02 | [High-Level Design](02-hld.md) | Components, request flows, scaling, caching, security, observability |
| 03 | [Data Model](03-data-model.md) | ERD, table-by-table spec, plane ownership |
| 04 | [API Design](04-api.md) | Product API + Intelligence API, streaming & auth contracts |
| 05 | [Folder Structure](05-folder-structure.md) | Monorepo layout and rationale |

## TL;DR

VAYU AI is a **two-plane polyglot** system over **one Postgres + one Redis**:

- **Product plane** — Next.js 16 (UI + BFF). Better Auth, workspaces, documents, editor,
  collaboration. Drizzle → Postgres.
- **Intelligence plane** — FastAPI. RAG, embeddings (pgvector), LangGraph agents, streaming.
  SQLAlchemy → Postgres.
- **Bridge** — stateless JWT (Better Auth mints, FastAPI verifies via JWKS) + shared Redis.

Each plane is stateless and independently scalable; the boundary is HTTP + JWT, so it can
become a true service split with no schema rewrite.
