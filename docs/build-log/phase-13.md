# Phase 13 — Testing

**Status:** ✅ Complete · Commit _(this phase)_

## Goal
Unit tests on both planes, wired into CI.

## Delivered
- **Web:** Vitest (`vitest.config.ts`, node env) + `lib/rbac.test.ts` — verifies the role
  hierarchy and the `can()` permission map (pure logic, no DB). `pnpm -C apps/web test`.
  RBAC imports `Role` as a type-only import, so the test runs without resolving `@vayu/db`
  at runtime.
- **AI:** added `tests/test_prompts.py` (command set + `build_prompt` tone/context/empty
  cases). Suite is now 15 tests (health, RAG, agents, prompts).
- **CI:** web job runs `pnpm -C apps/web test` after the build.

## Verification
- `vitest run` → 3 pass; `pytest` → 15 pass.

## Notes
Heavier coverage (Playwright e2e, RAG/agent eval harness, coverage gates) is the natural
next layer — the unit foundation + build-as-typecheck already guard regressions across phases.
