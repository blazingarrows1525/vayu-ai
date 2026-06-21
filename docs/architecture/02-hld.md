# VAYU AI — High-Level Design

Companion to `01-overview.md`. This covers the component decomposition, the critical
request flows, and the scaling / caching / security architectures.

---

## 1. Component diagram

```mermaid
flowchart TB
    subgraph Client["Client (browser)"]
        UI["React 19 UI · Tiptap editor · ShadCN"]
    end

    subgraph Web["Product plane — Next.js 16 (Vercel)"]
        RSC["RSC + Server Actions"]
        BFF["BFF / Route Handlers"]
        AUTH["Better Auth (JWT + refresh, JWKS)"]
    end

    subgraph AI["Intelligence plane — FastAPI (Railway / ECS)"]
        COPILOT["Copilot · streaming gen"]
        RAG["RAG pipeline · retrieval"]
        AGENTS["LangGraph agent runtime"]
        WORKER["Async worker (long agent runs)"]
    end

    subgraph Data["Data tier"]
        PG[("Postgres + pgvector")]
        REDIS[("Redis · cache/ratelimit/queue/pubsub")]
        BLOB[("S3-compatible object store")]
    end

    subgraph Ext["External"]
        LLM["LLM providers (OpenAI / Anthropic / Gemini)"]
    end

    UI -->|HTTPS| RSC
    UI -->|HTTPS| BFF
    BFF --> AUTH
    RSC -->|Drizzle| PG
    BFF -->|Drizzle| PG
    BFF -->|JWT + SSE proxy| COPILOT
    BFF -->|JWT| RAG
    BFF -->|JWT| AGENTS
    COPILOT --> LLM
    RAG -->|SQLAlchemy| PG
    RAG --> LLM
    AGENTS --> WORKER
    WORKER --> LLM
    AGENTS -->|SQLAlchemy| PG
    COPILOT --> REDIS
    RAG --> REDIS
    AGENTS --> REDIS
    RAG --> BLOB
    AUTH -.JWKS.-> AI
```

---

## 2. Critical request flows

### 2.1 Inline AI copilot (streaming)

```mermaid
sequenceDiagram
    participant U as Browser
    participant W as Next.js BFF
    participant A as FastAPI (copilot)
    participant L as LLM provider

    U->>W: POST /api/ai/copilot {cmd:/improve, selection, docId}
    W->>W: Better Auth verify session → mint access JWT
    W->>W: RBAC: can user edit docId?
    W->>A: POST /v1/copilot (Bearer JWT, traceparent)
    A->>A: Verify JWT via JWKS, load doc context
    A->>L: stream completion
    L-->>A: token stream
    A-->>W: SSE: token deltas
    W-->>U: SSE relay (text/event-stream)
    A->>A: persist ai_generations (tokens, cost, latency)
```

The BFF is a **thin authenticated proxy** for streaming: it owns identity & RBAC, the AI
plane owns generation. The browser never holds a provider key or a service URL.

### 2.2 RAG query (grounded answer with citations)

```mermaid
sequenceDiagram
    participant U as Browser
    participant W as Next.js BFF
    participant A as FastAPI (RAG)
    participant P as Postgres/pgvector
    participant L as LLM provider

    U->>W: POST /api/research/ask {query, sourceScope}
    W->>A: POST /v1/rag/ask (Bearer JWT)
    A->>A: embed(query) [cache: hash(query,model)]
    A->>P: vector search WHERE workspace_id=? ORDER BY embedding <=> q LIMIT k
    P-->>A: top-k chunks + metadata
    A->>A: rerank + assemble grounded prompt
    A->>L: answer with [chunk] context
    L-->>A: answer
    A->>A: confidence = f(similarity, coverage, agreement)
    A-->>W: {answer, citations[], confidence, retrieval[]}
    W-->>U: render answer + sources + transparency panel
```

### 2.3 Document ingestion (upload → searchable)

`Upload → S3` → enqueue Redis job → worker: `parse → chunk → embed (batched) → upsert
embeddings (pgvector)` → mark `knowledge_sources.status = ready`. The HTTP request returns
immediately with a `processing` source; the UI subscribes to status via polling or Redis
pub/sub. Long work never blocks a request.

### 2.4 Agent run (LangGraph, async + checkpointed)

`BFF → POST /v1/agents/{type}/run` returns a `run_id` fast. LangGraph executes a state
machine (plan → tool calls → synthesize), **checkpointing each step** to `agent_runs` /
`agent_steps`. Progress streams over SSE; a crashed worker resumes from the last checkpoint.
Human-in-the-loop steps pause the graph until the user approves.

---

## 3. Scaling strategy

| Tier | Scale unit | Signal | Notes |
|---|---|---|---|
| Product plane | Stateless Next.js instances / edge | RPS, CPU | Sessions in cookies+Redis, not memory |
| Intelligence plane | Stateless FastAPI replicas | inflight requests, queue depth | No sticky state; JWT-authenticated |
| Agent workers | Worker pool consuming Redis queue | queue depth | Long runs decoupled from HTTP |
| Postgres | Vertical first, then read replicas | conns, IOPS | PgBouncer pooling; replicas for analytics/RAG reads |
| pgvector | HNSW index; partition by workspace at scale | recall/latency | Start single table; partition when hot |
| Redis | Single → cluster | memory, ops/s | Namespaced keys per concern |

**Principle:** keep both planes stateless so scaling is "add replicas." All durable state
lives in Postgres / Redis / S3.

---

## 4. Caching strategy

| Layer | What | Key | TTL / invalidation |
|---|---|---|---|
| CDN / edge | Static assets, RSC payloads | route + cache tags | tag-based revalidation on write |
| Redis — query embeddings | `embed(query)` vectors | `emb:{model}:{sha1(query)}` | 24h |
| Redis — RAG retrieval | top-k for a (query, scope) | `rag:{workspace}:{sha1(query+scope)}` | 10 min |
| Redis — AI idempotency | dedupe identical generations | `gen:{sha1(prompt+params)}` | 1h |
| Redis — rate limits | token-bucket counters | `rl:{userId}:{route}` | sliding window |
| Redis — session/RBAC | hot membership lookups | `mem:{userId}:{workspace}` | 5 min, busted on role change |
| Postgres | materialized analytics rollups | — | scheduled refresh |

Write-through on document edits busts the relevant RAG/embedding caches scoped to that
document so research answers never go stale silently.

---

## 5. Security architecture

```mermaid
flowchart LR
    A["Browser"] -->|httpOnly secure cookie| B["Next.js BFF"]
    B -->|Better Auth: access JWT 15m + refresh rotation| B
    B -->|Bearer JWT| C["FastAPI"]
    C -->|verify via JWKS| D["Better Auth JWKS endpoint"]
    B -->|RBAC: membership.role| E[("Postgres")]
    C -->|claims: sub, workspace_id, role| C
```

- **AuthN:** Better Auth — access JWT (short-lived) + rotating refresh token in httpOnly,
  `SameSite=Lax`, `Secure` cookie. JWTs signed with rotating keys exposed via JWKS.
- **AuthZ:** RBAC keyed on `memberships(workspace_id, user_id, role ∈ {owner,admin,editor,
  viewer})`. Enforced in the BFF on every mutation **and** re-checked in the AI plane from
  JWT claims — defense in depth.
- **Tenant isolation:** every domain row carries `workspace_id`; queries are workspace-scoped;
  Postgres RLS policies are ready to switch on for hard isolation.
- **Input safety:** rich text sanitized (server-side, allowlist) before persistence; all
  inputs validated (zod in TS, Pydantic in Py); SQL only through parameterized ORM queries.
- **Transport/headers:** strict CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`.
- **Abuse:** Redis token-bucket rate limits per user+route; AI spend caps per workspace.
- **Audit:** `audit_logs` records actor, action, target, ip, metadata for sensitive ops.
- **Secrets:** env-injected (SSM/Vault in prod); provider keys live only in the AI plane.

---

## 6. Observability architecture

- **Tracing:** OpenTelemetry SDK in both planes; BFF injects W3C `traceparent`, FastAPI
  continues the trace — one span tree spans browser→BFF→AI→LLM.
- **Logs:** structured JSON (pino in TS, structlog in Py) with `trace_id`, `user_id`,
  `workspace_id`, `request_id` on every line.
- **Errors:** Sentry in both runtimes, releases tied to git SHA.
- **AI-specific metrics:** tokens in/out, $ cost per generation, model latency, retrieval
  hit-rate, agent step durations, queue depth — exported via OTel metrics.

See `04-api.md` for the concrete endpoints and the streaming contract.
