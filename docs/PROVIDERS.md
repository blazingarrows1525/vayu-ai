# Providers — LLMs, embeddings & vector stores

VAYU's intelligence plane is provider-pluggable. Everything is **opt-in and degrades
gracefully**: with only the defaults it runs on Anthropic + Voyage + in-DB pgvector; add keys to
unlock more. Live status for any deployment is at **`GET /v1/providers`**.

## LLM providers (chat / copilot / agents / RAG grounding)

| Provider | Env key | Default model (`*_CHAT_MODEL`) | Notes |
|---|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` (`DEFAULT_CHAT_MODEL`) | native SDK, streaming |
| Google Gemini | `GEMINI_API_KEY` | `gemini-2.5-pro` | via Gemini's OpenAI-compatible endpoint |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` | |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | hosted OSS models |
| OpenRouter | `OPENROUTER_API_KEY` | `anthropic/claude-3.5-sonnet` | any OpenRouter model id |

- **Preferred provider:** `DEFAULT_LLM_PROVIDER` (default `anthropic`). A request may override it
  per call (copilot `provider` field).
- **Cross-provider fallback:** `generate()` / `generate_json()` / `stream_generate()` try the
  preferred → default → remaining *configured* providers in order. If the preferred one errors
  (after its own SDK retries), the next configured provider handles the request. The requested
  `model` is only applied to the preferred provider — fallbacks use their own default (so a
  Gemini model id is never sent to Groq).
- **Retries:** each SDK client retries transient errors (429 / 5xx / timeouts) with backoff,
  `LLM_MAX_RETRIES` times (default 2).
- **Structured output:** `complete_structured()` / `generate_json()` request a JSON object
  (`response_format`) and parse it, tolerating code fences / prose and degrading to plain-text
  parsing if a model doesn't support `response_format`.

### Gemini specifics

You said you have Gemini Pro — the default is `gemini-2.5-pro`. To trade cost for speed set
`GEMINI_CHAT_MODEL=gemini-2.5-flash` (or `gemini-2.0-flash`). To make Gemini the primary model:

```env
GEMINI_API_KEY=your-key
DEFAULT_LLM_PROVIDER=gemini
```

Get a key at <https://aistudio.google.com/apikey>. VAYU talks to Gemini through its
OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`), so the
same streaming / structured-output / retry paths apply.

## Embeddings (RAG)

Chat and embeddings are **separate** — Anthropic has no embeddings model.

| Provider | Env | Model | Dim |
|---|---|---|---|
| Voyage (default) | `VOYAGE_API_KEY` | `voyage-3` | 1024 |
| OpenAI | `OPENAI_API_KEY` | `text-embedding-3-small` | 1536 |

Switch with `EMBEDDING_PROVIDER=voyage|openai`. **Dimensions differ**, so switching requires
re-indexing the `embedding` pgvector column to the new `EMBEDDING_DIM` (and rebuilding the HNSW
index). Voyage keys: <https://www.voyageai.com/>.

## Vector stores

`VECTOR_STORE` selects where vector similarity search runs. **pgvector** (in Postgres) is the
default and needs no extra service; it also powers hybrid keyword + MMR retrieval.

| `VECTOR_STORE` | Required env | Notes |
|---|---|---|
| `pgvector` (default) | — | in-DB; hybrid (vector + keyword) + MMR rerank |
| `qdrant` | `QDRANT_URL` (+ `QDRANT_API_KEY`) | REST API |
| `chroma` | `CHROMA_URL` | self-hosted Chroma |
| `pinecone` | `PINECONE_API_KEY` + `PINECONE_INDEX_HOST` | index provisioned out-of-band |

How external stores work here:
- **Dual-write on ingest** — embeddings are always written to Postgres (system of record: keeps
  citations + keyword search) *and* mirrored to the selected external store (best-effort; a
  mirror failure never breaks ingestion).
- **Retrieval** — when an external store is configured, `rag/ask` and vault search use its
  vector ANN (`store.query`) and ground the answer from those hits.
- **Fallback** — if a store is selected but unreachable/misconfigured, VAYU logs a warning at
  startup and per-request, and falls back to pgvector.

`VECTOR_COLLECTION` (default `vayu_embeddings`) names the collection/index.

## Checking status

```bash
curl -s https://<ai-host>/v1/providers | jq
```

```json
{
  "default_llm_provider": "anthropic",
  "llm": [{"provider": "anthropic", "available": true}, {"provider": "gemini", "available": true}, ...],
  "embeddings": {"provider": "voyage", "model": "voyage-3", "available": true},
  "vector_store": {"store": "pgvector", "external": false, "available": true},
  "storage": {"provider": "s3", "available": false}
}
```

The AI plane also logs `no_llm_provider_configured`, `embeddings_key_missing`, and
`vector_store_selected_but_unavailable` at startup so misconfiguration is obvious without a crash.

See also: [DEPLOYMENT.md](DEPLOYMENT.md) · [AWS_S3_SETUP.md](AWS_S3_SETUP.md).
