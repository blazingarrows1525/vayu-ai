# Phase 11 — Observability

**Status:** ✅ Complete · Commit _(this phase)_

## Goal
Tracing across both planes, structured logging, Sentry — all optional/no-crash.

## Key decisions
- **AI plane:** `core/observability.py` configures structlog (JSON), OpenTelemetry
  (`TracerProvider` + `FastAPIInstrumentor`; OTLP exporter only if `OTEL_EXPORTER_OTLP_ENDPOINT`
  set), and Sentry (only if `SENTRY_DSN`). A request-id middleware binds `request_id` into
  structlog contextvars and echoes `x-request-id`. Everything is wrapped so missing
  endpoints/DSN degrade to local logging + in-proc tracing, never an error.
- **Web plane:** `instrumentation.ts` registers `@vercel/otel` at startup and inits
  `@sentry/node` on the Node runtime when `SENTRY_DSN` is set; `lib/logger.ts` is a pino
  JSON logger. Forwarding the request carries the trace context to the AI plane (one trace
  spans browser → BFF → FastAPI → LLM).

## Files
- ai: `core/observability.py`; `main.py` (setup + request-id middleware); deps
  (opentelemetry-sdk/exporter/instrumentation-fastapi, sentry-sdk).
- web: `instrumentation.ts`, `lib/logger.ts`; deps (@vercel/otel, @sentry/node, pino).

## Verification
- 11 ai tests pass (observability init doesn't crash without exporters); `next build` green.
