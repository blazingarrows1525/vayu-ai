# Phase 5 — AI Writing Copilot

**Status:** ✅ Complete · Commit `4290bd4`

## Goal
Real streaming generation through the BFF → FastAPI SSE proxy, with a usage ledger.

## Key decisions
- Anthropic streaming via `AsyncAnthropic().messages.stream()` (`text_stream` +
  `get_final_message()`); default model **`claude-opus-4-8`** (per claude-api skill).
- 12 commands (`/improve`, `/rewrite`, …) with per-command prompts.
- **Redis idempotency cache** (hash of command+selection+context+tone+model) — degrades to
  no-op if Redis is down.
- The **BFF tees the SSE `usage` event** into the product-owned `ai_generation` ledger
  (respecting plane ownership) while relaying tokens to the browser.
- Graceful no-key fallback: streams an informative notice + `configured:false`.

## Files
- ai: `services/llm.py`, `core/prompts.py`, `services/{redis,cache}.py`, `api/v1/copilot.py`.
- web: `app/api/ai/copilot/route.ts` (tee proxy), `lib/use-copilot.ts`, `components/copilot-panel.tsx`,
  editor `onCreate` wiring.

## Verification
- `next build` (9 routes). SSE smoke test (`AUTH_ALLOW_DEV_TOKEN=true`, no key) streamed
  `token…→usage(model=claude-opus-4-8)→done`; **401** no-auth; **422** bad command.

## Pending (live)
Real output needs `ANTHROPIC_API_KEY`; ledger write needs the DB.
