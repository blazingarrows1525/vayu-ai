# Phase 16 — Editor drag-handle + version diff (deferred items closed)

**Status:** ✅ Complete · Post-1.0 polish

Closes the two items previously marked "deferred" in phases 4 and 10. Most of this landed as
external (Codex) edits; the diff API route needed correcting to match codebase conventions.

## Delivered
- **Editor drag-handle** (closes Phase 4 deferred) — `@tiptap/extension-drag-handle-react` in
  `@vayu/editor`; `editor.tsx` renders a `<DragHandle>` with a grip icon, styled via
  `styles.css` (`.vayu-drag-handle`). Blocks can now be grabbed and reordered.
- **Version diff visualization** (closes Phase 10 deferred) — `/docs/[id]` History panel gains a
  **diff** button per snapshot that word-diffs against the previous version, rendered inline
  (green = added, rose strike-through = removed). Uses the `diff` library + `@types/diff`.

## Correction applied (the Codex diff route was broken)
`apps/web/app/api/documents/[id]/diff/route.ts` as dropped in used non-existent imports and an
unscoped query. Rewritten to the codebase's conventions:
- `getAuth` from `@/lib/auth` (doesn't exist) → **`checkPermission("document:read")`** from `@/lib/session`.
- `@vayu/db/src/schema` deep import → **`@vayu/db`** barrel.
- `db.query.documentVersion.findFirst` (relations API not configured) → **`db.select().from(...)`**.
- **Added workspace scoping** — verifies the document belongs to the caller's workspace via
  `getDocument(id, ctx.workspaceId)` before returning any snapshot (closed an IDOR gap where any
  authed user could diff any document by id).
- Word diff via `Diff.diffWords`; response `{ from, to, changes }` matches the page renderer.

## Verification
- `pnpm install` + `pnpm -C apps/web build` → green (diff route + drag-handle compile).
