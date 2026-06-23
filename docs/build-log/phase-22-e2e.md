# Phase 22 — Playwright e2e scaffold

**Status:** ✅ Scaffold complete (build-verified) · live run executes in CI

## Goal
Stand up the end-to-end test layer (CRISP Phase 9) and wire it into CI.

## Delivered
- **`@playwright/test`** dev dependency + `playwright.config.ts` (chromium project, `baseURL`,
  `webServer: pnpm start` with dummy env, CI retries/forbidOnly).
- **`e2e/smoke.spec.ts`** — three smoke tests on routes that don't require a DB:
  landing hero + floating dock visible, sign-in page renders, and `/dashboard` redirects
  unauthenticated users to `/login` (exercises the proxy guard).
- **`test:e2e`** script + a **CI `e2e` job**: `playwright install --with-deps chromium` → build →
  `test:e2e` (the webServer serves the production build; smoke routes need no DB).

## Validation
- `playwright test --list` → **3 tests collected** (config + specs parse/compile);
  `next build` green with the e2e files in the tree.
- The browser run itself executes in CI (needs the downloaded browser + served app) — not run on
  this machine. Deeper authenticated e2e (editor/research/agents) needs a live DB + keys.
