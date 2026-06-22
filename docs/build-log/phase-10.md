# Phase 10 — Version Control & Analytics

**Status:** ✅ Complete · Commit _(this phase)_

## Goal
Git-for-docs (snapshots, timeline, restore) + workspace analytics.

## Key decisions
- Versions are immutable snapshots in `document_version` (content JSONB + summary). `currentVersion`
  on the document is bumped on each snapshot. Restore sets the document's content to a snapshot
  and the editor reflects it live via `editor.commands.setContent`.
- Analytics computed in the BFF from product tables: documents, words (from `content_text`),
  reading time (words/200), edited-this-week, and AI usage (count/tokens/cost from `ai_generation`).

## Files
- web: `lib/data.ts` (+createVersion/listVersions/restoreVersion/getAnalytics);
  routes `api/documents/[id]/versions`, `.../restore`, `api/analytics`; `/analytics` page;
  History panel added to `/docs/[id]`; `proxy.ts` guards `/analytics`.

## Verification
- `next build` green (versions/restore/analytics routes + history UI compiled).

## Pending (live)
Needs the DB. Deferred: visual diff between snapshots (data is there — render is a UI layer).
