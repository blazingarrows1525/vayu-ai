# VAYU AI — Executive Architecture Overview

> **Intelligence at the speed of thought.**

VAYU AI is an AI-native workspace that fuses a Notion-grade editor, a Perplexity-style
research engine, and a fleet of LangGraph agents into one product. This document is the
entry point to the architecture. It states the product vision, the one decision the whole
system hangs on, and the tradeoffs a reviewer should expect us to defend.

---

## 1. Product vision

A single surface where a user can **write, research, reason, and remember**:

- **Write** in a block-based editor with an AI copilot inline (`/rewrite`, `/continue`, …).
- **Research** by uploading documents and asking grounded questions with citations.
- **Reason** by handing work to specialized agents (research, SEO, docs, interview prep).
- **Remember** through a semantic knowledge vault with a graph of related ideas.

Target users span students → researchers → engineers → product teams → enterprises. The
same primitives (documents, blocks, embeddings, agents) serve all of them; tenancy and
RBAC are what make it safe for teams.

### Non-functional north stars

| Property | Target |
|---|---|
| Performance | Lighthouse > 95; p95 editor interaction < 50 ms; first AI token < 1 s |
| Scalability | Stateless planes; horizontal scale; async agent execution |
| Security | JWT + refresh rotation, RBAC, RLS-ready tenant isolation, audit logs |
| Observability | OTel traces across planes, structured logs, Sentry, AI usage metrics |
| Cloud readiness | 12-factor, containerized, IaC-friendly, provider-agnostic models |

---

## 2. The decision everything hangs on: two planes, one data tier

The spec names Better Auth (TypeScript) **and** FastAPI + LangGraph (Python). Rather than
fight that, we make it the architecture.

```
                 ┌───────────────────────── Product plane (TypeScript) ─────────────────────────┐
   Browser  ───▶ │  Next.js 16 App Router                                                       │
                 │  • UI (React 19, Tiptap editor, ShadCN)                                       │
                 │  • BFF: Better Auth, document CRUD, workspace/RBAC, SSE proxy                 │
                 └───────────────┬───────────────────────────────────┬──────────────────────────┘
                                 │ Drizzle                            │ JWT (Bearer) + traceparent
                                 ▼                                    ▼
                 ┌── Postgres (one cluster) ──┐        ┌──────────── Intelligence plane (Python) ─┐
                 │  product tables            │◀──────▶│  FastAPI (async)                          │
                 │  ai tables + pgvector      │  SQLA  │  • RAG pipeline, embeddings               │
                 └────────────┬───────────────┘        │  • LangGraph agents, tool calling        │
                              │                         │  • Streaming generation (SSE)            │
                       ┌──────▼──────┐                  └───────────────┬───────────────────────────┘
                       │   Redis     │◀─────────────────────────────────┘
                       │ cache · ratelimit · queue · pub/sub
                       └─────────────┘
```

**Why split**

- **Right tool per capability.** The agent/RAG ecosystem (LangGraph, LangChain, parsers,
  tokenizers) is Python-first. The product UI/DX and auth ecosystem (Better Auth, Tiptap,
  RSC) is TypeScript-first. We stop paying a translation tax in both directions.
- **Independent scaling.** Editor traffic is many small, latency-sensitive requests; agent
  runs are few, long, CPU/IO-heavy, bursty. Coupling them forces one scaling profile on
  two opposite workloads. Split, each plane autoscales on its own signal.
- **Clear bounded contexts.** Product owns identity & documents; intelligence owns
  embeddings & agent runs. Ownership is enforced at the table level (see `03-data-model`).

**Why one Postgres, not two databases**

- A portfolio system gains nothing from premature data-tier sprawl. One cluster keeps joins
  cheap, backups simple, and tenancy uniform. Ownership is enforced by **convention +
  migrations**, not by separate servers: each plane runs its own migrations over a disjoint
  set of tables. Cross-plane references are by UUID, not hard FK, so the boundary can later
  become a true service split with zero schema rewrites.

**The bridge: a stateless JWT**

- Better Auth issues a short-lived access JWT (15 min) + rotating refresh token (httpOnly
  cookie). The BFF attaches the JWT when it calls the AI plane. FastAPI verifies it against
  Better Auth's **JWKS** endpoint (no shared secret, keys rotate freely) and reads
  `sub`, `workspace_id`, and `role` claims to enforce RBAC. The AI plane is therefore
  **stateless and independently deployable** — it never touches the session store.

---

## 3. Tradeoffs we accept (and how we pay them down)

| Cost of the split | Mitigation |
|---|---|
| Two runtimes / two package managers | pnpm + Turborepo for TS, uv for Python; one `docker-compose up` boots both |
| Cross-service contracts can drift | Single source of truth: FastAPI emits OpenAPI → typed TS client generated in CI |
| Schema could be duplicated | Disjoint table ownership; cross-plane refs are UUIDs only; no duplicated DDL |
| JWT/JWKS plumbing | Encapsulated in one dependency on each side; integration-tested |
| Distributed tracing is harder | Propagate W3C `traceparent` BFF→AI; one trace spans both planes in OTel |

If a reviewer pushes "why not a monolith?" — the honest answer: for a single-language CRUD
app, a monolith wins. VAYU's defining workload is *Python-native AI orchestration alongside
a TypeScript-native product surface*. The split is justified by capability, not fashion, and
it's reversible because the contract is HTTP + JWT, not shared memory.

---

## 4. Interview discussion points this architecture sets up

- **System design:** BFF pattern, bounded contexts, stateless auth, async job execution.
- **RAG:** chunking strategy, embedding model choice, HNSW vs IVFFlat, retrieval caching,
  grounding + citation, hallucination guardrails, confidence scoring.
- **Agents:** LangGraph state machines, tool calling, checkpointing, human-in-the-loop.
- **Data:** multi-tenant isolation, RLS, pgvector indexing, version history as an event log.
- **Platform:** JWKS-based service auth, Redis token-bucket rate limiting, OTel cross-plane
  tracing, CI-generated typed clients, blue/green deploy of an independently scalable AI tier.

See `02-hld.md` for the high-level design, `03-data-model.md` for the schema, and
`04-api.md` for the API surface and streaming contract.
