# Phase 4 — VAYU Editor (Tiptap)

**Status:** ✅ Complete · Commit `f217e16`

## Goal
A reusable, Notion-grade block editor.

## Delivered (`packages/editor`, Tiptap 3.27.1)
- **Slash command menu** (`/`) — 15 block types, fuzzy search, keyboard nav, no `tippy` dep
  (custom ReactRenderer popup).
- Tables (resizable), task lists, images, links, code with syntax highlighting (lowlight),
  **KaTeX math** (inline/block), **Mermaid** diagram blocks (lazy-loaded), custom **Callout**
  node (info/success/warn/danger).
- `vayu-prose` dark stylesheet reading the app's design tokens.
- `VayuEditor` React component (`immediatelyRender: false` for Next SSR); `onCreate`/`onUpdate`.

## Integration
- `apps/web/app/editor` demo route; landing CTA → `/editor`; `transpilePackages: ["@vayu/editor"]`.

## Verification
- `next build` green (8 routes); `/editor` prerenders + serves **200**.

## Deferred
- Drag-and-drop block *handles* (add `@tiptap/extension-drag-handle-react`).
