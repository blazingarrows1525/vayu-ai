# Phase 20 — Chat / conversation persistence

**Status:** ✅ Complete (build-verified)

## Goal
Persist conversations + messages (CRISP Phase 7 "chat history / conversation persistence") —
the foundation for resumable copilot/agent threads.

## Delivered
- **Schema** (`packages/db/src/schema/chat.ts`): `conversation` (workspace + user scoped, title,
  optional `agentType`, timestamps) and `message` (role, content, provider, model, tokens, jsonb
  metadata) with indexes; barrel + inferred `Conversation`/`Message` types exported.
- **Migration** regenerated → `drizzle/0001_dazzling_silver_samurai.sql` (conversation + message).
- **Data layer** (`apps/web/lib/data.ts`): `createConversation`, `listConversations` (per
  user+workspace), `getConversation` (ownership), `listMessages`, `appendMessage` (also bumps the
  conversation's `updatedAt`).
- **BFF routes** (workspace-scoped, RBAC-gated):
  - `GET/POST /api/conversations` — list / create.
  - `GET/POST /api/conversations/[id]/messages` — list / append (both verify the conversation
    belongs to the caller's workspace before touching messages).

## Reason
A production assistant needs durable threads — history, resume, and per-message provenance
(provider/model/tokens) for cost attribution.

## Validation
- `drizzle-kit generate` emitted the migration cleanly; `tsc --noEmit` on `@vayu/db` clean;
  `next build` green (`/api/conversations` + `/api/conversations/[id]/messages` routes emitted).
- Gated on DB: live persistence needs Postgres (Docker + `pnpm db:migrate`); schema + queries +
  routes verified here. UI history sidebar is the natural next step.
