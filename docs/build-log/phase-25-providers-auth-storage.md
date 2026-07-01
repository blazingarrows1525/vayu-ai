# Phase 25 — Multi-provider LLMs, vector stores, OAuth, and AWS S3

**Status:** ✅ Shipped to `main` · CI green · live deploy healthy (`/v1/providers` reports the new
`vector_store` + `storage` status)

This phase makes the intelligence plane genuinely provider-pluggable and finishes the auth +
storage stories. Everything is **opt-in and degrades gracefully** — the live deploy kept working
through every push (no new *required* secret).

---

## 1 · LLM layer hardened (Gemini-first)

`apps/ai/app/services/llm.py`:
- **Cross-provider fallback** — `generate()` / `generate_json()` / `stream_generate()` try
  preferred → default → remaining *configured* providers; the requested model is only applied to
  the preferred one (a Gemini id is never sent to Groq). Wired into RAG grounding + copilot.
- **Structured output** — `complete_structured()` requests a JSON object (`response_format`) and
  parses it, tolerating code fences/prose and degrading to plain-text parse if unsupported.
- **Retries** — each SDK client retries transient errors (429/5xx/timeouts), `LLM_MAX_RETRIES`×.
- **Gemini default → `gemini-2.5-pro`** (via the OpenAI-compat endpoint). Refreshed pricing.

## 2 · External vector stores wired end-to-end

The Qdrant/Chroma/Pinecone adapters existed but were never called. Now (`rag/pipeline.py`):
- **Dual-write on ingest** — embeddings go to Postgres (system of record: citations + keyword
  search) *and* mirror to the selected external store (best-effort; never breaks ingest).
- **Retrieval** — `rag/ask` + vault search use the external store's vector ANN when
  `VECTOR_STORE` ≠ pgvector, grounding from those hits.
- **Fallback + validation** — misconfigured/unreachable store → warn + fall back to pgvector.
  Status in `/v1/providers`; startup logs `vector_store_selected_but_unavailable`.

## 3 · Google + GitHub OAuth

- Buttons on login **and** signup (`components/auth-form.tsx`), shown only when the provider is
  configured — gated by a new server route `GET /api/auth-providers` that mirrors the conditional
  `socialProviders` in `lib/auth.ts` (no secrets exposed).
- Better Auth handles the callback (`/api/auth/callback/{provider}`) + session. Redirect URLs and
  setup are documented in `.env.example` + `PROVIDERS.md`.

## 4 · Real AWS S3

- `s3_endpoint` now defaults **blank** → real AWS regional endpoint (was hardcoded to MinIO's
  `localhost:9000`, which broke AWS). Bucket auto-create passes a region `LocationConstraint`
  (required outside `us-east-1`). MinIO/R2/B2 still work by setting `S3_ENDPOINT`.
- Full walkthrough: **`docs/AWS_S3_SETUP.md`** (account → bucket → least-privilege IAM → keys →
  env → test → security).

## 5 · Config validation & docs

- **Fail-soft startup checks** (`main.py`) warn (don't crash) on no LLM provider, missing
  embeddings key, or an unavailable selected vector store.
- `/v1/providers` now also reports `vector_store` + `storage`.
- New **`docs/PROVIDERS.md`** (LLM/embeddings/vector-store reference); `.env.example`,
  `render.yaml`, and `DEPLOYMENT.md` updated for the extra providers + vector stores.

---

## Verification

| Check | Result |
|---|---|
| `ruff` (ai) | ✅ clean |
| `pytest` (ai) | ✅ **52 passed** (+20: LLM orchestration, vector wiring, storage) |
| `pnpm -C apps/web build` | ✅ compiled |
| `vitest` (web) | ✅ 3 passed |
| `playwright --list` | ✅ 6 tests |
| CI (web/ai/e2e/deploy) | ✅ green |
| Live `/v1/providers` | ✅ reports llm + embeddings + vector_store + storage |

Docker wasn't running locally, so the external vector-store *services* and S3 network paths are
covered by unit tests (fakes) + the interface contract + CI, not a live local run.

## Activate in production (Render dashboard — optional)

- **Gemini/others:** set `GEMINI_API_KEY` (and/or `GROQ_API_KEY`, `OPENROUTER_API_KEY`) on
  `vayu-ai`. Optionally `DEFAULT_LLM_PROVIDER=gemini`.
- **OAuth:** set `GOOGLE_CLIENT_ID/SECRET` and/or `GITHUB_CLIENT_ID/SECRET` on `vayu-web`
  (register the callback URLs — see `.env.example`).
- **S3 storage:** set `S3_*` on `vayu-ai` (see `AWS_S3_SETUP.md`).
- **External vector store:** set `VECTOR_STORE` + its URL/API key on `vayu-ai`.

See also: [PROVIDERS.md](../PROVIDERS.md) · [AWS_S3_SETUP.md](../AWS_S3_SETUP.md) ·
[phase-24-hardening.md](phase-24-hardening.md).
