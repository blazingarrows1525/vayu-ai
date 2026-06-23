# Phase 18 — Productionization: URL ingestion, rate limiting, security headers

**Status:** ✅ Complete (build-verified)

## Goal
Close the next audit gaps: web-URL ingestion for RAG, request rate limiting, and HTTP security
headers — without breaking graceful degradation.

## Delivered
### Web-URL ingestion (RAG source)
- `POST /v1/knowledge/ingest-url` — fetches a URL (httpx), extracts text (stdlib `HTMLParser` →
  `html_to_text`, dropping script/style), then runs the normal chunk→embed→store pipeline.
- **SSRF guard** `_is_public_url()` — resolves the host and rejects non-http(s), localhost,
  private/loopback/link-local/reserved/multicast IPs (blocks cloud-metadata + internal services).
- BFF proxy `/api/research/ingest-url` + a URL input on `/research`.

### Rate limiting (AI plane)
- `core/ratelimit.py` — Redis fixed-window limiter with an in-process **circuit breaker**
  (after a Redis failure it fails open and skips Redis for 30s, so an outage adds no latency).
- `main.py` middleware limits `/v1/*` to `rate_limit_per_min` (default 120) per client; **429** over.

### Security headers (web)
- `next.config.ts` `headers()` on every route: **CSP**, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.

## Files
- ai: `rag/parsing.py` (`html_to_text`), `api/v1/rag.py` (`/knowledge/ingest-url` + SSRF guard),
  `core/ratelimit.py`, `core/config.py` (`rate_limit_per_min`), `main.py` (rate-limit middleware).
- web: `next.config.ts` (security headers), `app/api/research/ingest-url/route.ts`, `/research` URL UI.

## Validation
- `ruff` clean; **`pytest` 21 pass** (6.4s — circuit breaker kept the suite fast with Redis down);
  `next build` green (`/api/research/ingest-url` route emitted, headers compile).
- Gated on infra: live URL fetch + rate-limit counting need network + Redis; verified at the
  parsing/guard/middleware layers here.
