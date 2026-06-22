# Phase 9 — Workspaces & Collaboration

**Status:** ✅ Complete · Commit _(this phase)_

## Goal
Documents, threaded comments + mentions, and workspace member/role management with RBAC.

## Key decisions
- A server-only data layer `apps/web/lib/data.ts` holds all Drizzle queries (documents,
  comments, members) — routes stay thin.
- Member mutations require `workspace:manageMembers` (admin+); reads require `document:read`.
- Invite is by existing-user email (demo); production would send an invite email.
- Mentions supported in the API (`mentions: string[]` → `mention` rows); UI autocomplete deferred.

## Files
- web: `lib/data.ts`; routes `api/documents` (+`/[id]`, `/[id]/comments`), `api/members`
  (+`/[userId]`); pages `/docs`, `/docs/[id]` (editor + Save + comments), `/settings/members`;
  `proxy.ts` guards `/docs` + `/settings`.

## Verification
- `next build` green (20 routes): documents/comments/members APIs + 3 new pages.

## Pending (live)
All of it is Drizzle-backed → needs the DB (Docker + `pnpm db:migrate`).
