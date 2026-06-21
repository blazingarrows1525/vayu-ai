# VAYU AI — API Design

Two surfaces:

1. **Product API** — Next.js Route Handlers / Server Actions (`/api/*`). Browser-facing,
   cookie-authenticated, owns RBAC. Talks to Postgres directly and proxies AI calls.
2. **Intelligence API** — FastAPI (`/v1/*`). Internal, JWT (Bearer) authenticated, called by
   the BFF (never the browser directly). Emits OpenAPI → typed TS client generated in CI.

Conventions: JSON bodies, `snake_case` on the Python API and `camelCase` on the TS API
(boundary mapper in the generated client). Errors use RFC 9457 `application/problem+json`.
Idempotent mutations accept an `Idempotency-Key` header.

---

## 1. Auth & identity (Better Auth, product plane)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/sign-up` | email/password registration |
| POST | `/api/auth/sign-in` | login → sets httpOnly session cookie |
| POST | `/api/auth/sign-out` | revoke session |
| POST | `/api/auth/refresh` | rotate refresh → new access JWT |
| GET | `/api/auth/session` | current user + active workspace |
| GET | `/api/auth/jwks` | public keys (JWKS) for the AI plane to verify JWTs |
| GET | `/api/auth/token` | mint a short-lived access JWT for the current session |

Access JWT claims: `sub` (user id), `workspace_id`, `role`, `exp` (15 min), `iss`, `aud`.

---

## 2. Workspaces, documents, collaboration (product plane)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/workspaces` | list / create |
| GET/PATCH/DELETE | `/api/workspaces/:id` | RBAC: admin+ |
| GET/POST | `/api/workspaces/:id/members` | invite / list; owner/admin |
| GET/POST | `/api/documents` | list (folder/tag filters) / create |
| GET/PATCH/DELETE | `/api/documents/:id` | autosave PATCH (debounced) |
| GET | `/api/documents/:id/versions` | timeline |
| POST | `/api/documents/:id/versions` | snapshot current |
| POST | `/api/documents/:id/restore/:version` | restore point |
| GET | `/api/documents/:id/diff?from=&to=` | diff visualization payload |
| GET/POST | `/api/documents/:id/comments` | threaded comments + mentions |
| GET/POST | `/api/folders`, `/api/tags` | organization |
| GET | `/api/search?q=` | hybrid: Postgres FTS + semantic (proxied) |

---

## 3. AI copilot (BFF proxy → FastAPI, streaming)

**Product side** `POST /api/ai/copilot`
```jsonc
{ "command": "/improve", "documentId": "…", "selection": "…", "context": "…", "tone": "formal" }
```
Response: `text/event-stream` relayed from the AI plane.

**Intelligence side** `POST /v1/copilot` (Bearer JWT) → SSE:
```
event: token   data: {"delta":"The "}
event: token   data: {"delta":"radar "}
event: usage    data: {"promptTokens":812,"completionTokens":140,"costUsd":0.0021}
event: done     data: {"generationId":"…"}
```
Supported commands: `/rewrite /improve /continue /summarize /expand /shorten /fix-grammar
/change-tone /generate-outline /generate-blog /generate-email /generate-docs`.

---

## 4. Research / RAG (FastAPI)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/knowledge/upload` | presign S3 + create `knowledge_source` (status=processing) |
| POST | `/v1/knowledge/:id/ingest` | enqueue parse→chunk→embed (idempotent) |
| GET | `/v1/knowledge/:id` | ingestion status, chunk/token counts |
| GET | `/v1/knowledge` | list sources in workspace |
| POST | `/v1/rag/ask` | grounded answer |

`POST /v1/rag/ask`
```jsonc
// request
{ "query": "…", "sourceScope": ["ks_id…"], "topK": 8 }
// response
{
  "answer": "…",
  "confidence": 0.82,                       // f(similarity, coverage, agreement)
  "citations": [{ "sourceId":"…","chunkIndex":3,"score":0.79,"snippet":"…" }],
  "retrieval": { "model":"text-embedding-3-small","candidates":24,"used":8 }
}
```
The `retrieval` block is the transparency panel — we always show *what* was retrieved.

---

## 5. Agents (FastAPI, LangGraph)

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/agents` | available agents + schemas |
| POST | `/v1/agents/:type/run` | start run → `{ runId }` (returns fast) |
| GET | `/v1/agents/runs/:id` | status + output + step trace |
| GET | `/v1/agents/runs/:id/stream` | SSE: per-step progress |
| POST | `/v1/agents/runs/:id/resume` | human-in-the-loop approval to continue |
| POST | `/v1/agents/runs/:id/cancel` | cancel |

Agent types: `research · writing · seo · docs · proofread · interview · resume`. Each is a
LangGraph state machine; steps are checkpointed to `agent_run.checkpoint` so a crashed worker
resumes mid-run.

---

## 6. Analytics (product plane)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/analytics/overview` | word count, reading time, writing velocity |
| GET | `/api/analytics/ai-usage` | tokens, cost, by command/model (from `ai_generation`) |
| GET | `/api/analytics/research` | ingestion + query activity |

---

## 7. Cross-cutting contract

- **AuthZ:** every product route resolves `membership.role` for the active workspace; AI
  routes re-derive it from JWT claims. A 403 is returned before any work is done.
- **Rate limiting:** Redis token bucket per `(userId, routeClass)`; AI routes additionally
  check workspace spend caps and return `429` with `Retry-After`.
- **Idempotency:** mutating AI calls hash `(prompt, params)`; a repeat within TTL returns the
  cached generation instead of re-billing the provider.
- **Tracing:** the BFF generates a `traceparent` and forwards it; the AI plane continues the
  same trace. Every response carries `x-request-id`.
- **Versioning:** the FastAPI surface is versioned (`/v1`); breaking changes ship under `/v2`
  with the generated client pinned per release.
