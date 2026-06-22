# Phase 15 — Floating UI overhaul

**Status:** ✅ Complete · Post-1.0 polish

## Context
The base UI was functional but flat. This pass adds a "command-center" visual language —
aurora background, glassmorphism, neon glow, and a floating AI dock — across the app.

## Also folded in: Codex's typecheck fixes (commit `b2c9702`)
Codex left uncommitted edits that fix package typechecking; verified `tsc --noEmit` clean on
both and committed them:
- `packages/db`: add `@types/node`; `rootDir` `src` → `.` (so `drizzle.config.ts` typechecks).
- `packages/editor`: add `@types/node`.

## Delivered
- **`app/globals.css`** — design-system upgrade: animated aurora field + faint engineering grid
  (`body::before/::after`), keyframes (`aurora`, `float`, `float-slow`, `pulse-glow`, `spin-slow`,
  `shimmer`, `rise`), and utilities (`.glass`, `.glow`, `.glow-violet`, `.glow-soft`,
  `.text-gradient`, `.text-shimmer`, `.animate-*`). Honors `prefers-reduced-motion`.
- **`components/floating-dock.tsx`** — a fixed, glassmorphic, macOS-style **floating dock** of
  glowing AI icons (Dashboard, Editor, Docs, Research, Agents, Vault, Analytics). Each icon
  floats (staggered delay), magnifies + glows on hover, shows a tooltip, and marks the active
  route. Hidden on `/login` `/signup`. Mounted globally in the root layout.
- **`app/page.tsx`** — landing rebuilt around a floating **AI core**: pulsing gradient orb with
  counter-rotating orbit rings and four floating capability chips; gradient hero headline;
  glass capability cards with hover-glow + staggered rise.
- **`app/layout.tsx`** — renders `<FloatingDock />` on every page.

## Verification
- `pnpm -C apps/web build` → green (all routes compiled, TypeScript clean).
- Pure CSS animations — **no new dependencies**. (Live preview screenshot was blocked by a
  dev-server first-compile timing issue in the cross-project preview harness, not a code fault;
  the production build is the authoritative check.)

## Notes
The dock is fixed `bottom-5` center; long pages should keep ~`pb-24` of breathing room
(landing uses `pb-32`).
