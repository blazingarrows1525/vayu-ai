# Phase 3 — Authentication & RBAC

**Status:** ✅ Complete · Commit `e9c68af`

## Goal
Better Auth + JWT/JWKS bridge + workspace RBAC, end to end.

## Key decisions
- Better Auth 1.6: email/password + optional GitHub/Google; **UUID ids**
  (`advanced.database.generateId: "uuid"`); `jwt` plugin issues 15-min tokens with
  `workspace_id` + `role` claims and serves JWKS at `/api/auth/jwks`.
- Signup **bootstraps a personal workspace** (databaseHook) so every user has a tenant.
- RBAC hierarchy `owner > admin > editor > viewer` + permission map (`lib/rbac.ts`).
- The BFF mints a JWT (`auth.api.getToken`) and forwards it to FastAPI, which verifies via
  `PyJWKClient`.

## Files
- web: `lib/auth.ts`, `lib/auth-client.ts`, `lib/session.ts`, `lib/rbac.ts`, `lib/workspace.ts`,
  `lib/ai.ts`, `app/api/auth/[...all]`, `app/api/ai/agents`, `proxy.ts`, `(auth)` + `dashboard` UI.
- db: added `jwks` table.

## Verification
- Full `next build` (TypeScript clean); migration regenerated (17 tables).
- Build caught + fixed: drizzle-orm bumped to **0.45** (better-auth peer); `middleware.ts` →
  `proxy.ts`; open-redirect in login flow restricted to same-origin paths.

## Pending (live)
Sign-up / JWKS round-trip needs the DB (Docker).
