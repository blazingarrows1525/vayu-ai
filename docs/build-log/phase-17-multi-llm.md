# Phase 17 — Multi-provider LLM layer

**Status:** ✅ Complete (build-verified) · Live activation needs provider keys

## Goal
Replace the Anthropic-only chat path with a unified, switchable, failover-aware multi-provider
layer with token + cost tracking — the biggest gap from the production-readiness audit.

## Design
- **One contract, many providers.** `LLMProvider` protocol (`stream` + `complete` + `available`).
  - `AnthropicProvider` — native `anthropic` SDK (unchanged behavior).
  - `OpenAICompatibleProvider` — one class for **OpenAI, Gemini, Groq, OpenRouter** via the
    `openai` SDK with per-provider base URLs (Gemini uses its OpenAI-compatible endpoint). No new
    deps. Streaming requests `stream_options.include_usage`; falls back to token estimation if a
    provider omits usage.
- **`resolve_llm(settings, preferred)`** — returns the first *available* provider trying
  `preferred → default_llm_provider → PROVIDER_ORDER`. This is both **provider switching**
  (preferred) and **failover** (skip unconfigured), raising `LLMUnavailable` only if none exist.
- **Token + cost tracking** — `Usage{input,output,cost_usd,model,provider}` on every call;
  `_PRICING` extended with OpenAI/Gemini/Groq model rates + a sane default.
- **`GET /v1/providers`** — configured/available state of every LLM + the embedding provider.
- **Embeddings abstraction** — `Embedder` now supports `openai` (SDK) **and** `voyage` (REST via
  httpx) behind one interface (dimension caveat documented).

## Files
- Modified: `core/config.py` (provider keys, `default_llm_provider`, per-provider models,
  embedding provider), `services/llm.py` (rewrite), `services/embeddings.py` (Voyage),
  `api/v1/copilot.py` + `rag/pipeline.py` + `agents/runner.py` (route via `resolve_llm`,
  graceful fallback preserved), `api/v1/health.py` (`/providers`), `.env.example`.
- Created: `tests/test_providers.py`.

## Reason
Enterprise deployments need provider choice (cost/latency/availability), graceful failover, and
spend visibility — not a single-vendor lock-in.

## Validation
- `ruff check .` clean; **`pytest` 21 pass** (+6: provider order, no-key raise, status shape,
  failover picks available, preferred wins, known-model cost). Copilot/RAG/agents still degrade
  gracefully when no key is set.
- **Gated on keys:** live generation through OpenAI/Gemini/Groq/OpenRouter requires the
  respective API keys; verified here at the abstraction + routing + cost layers.
