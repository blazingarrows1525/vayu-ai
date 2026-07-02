# Phase 26 — Cinematic 3D web experience

**Status:** ✅ Shipped to `main` · build + vitest + smoke e2e green · visually verified (dark, light, mobile, reduced-motion)

The landing page went from a CSS-animated hero to a **premium interactive experience**: a real-time
3D scene, cinematic scroll storytelling, and physical microinteractions — engineered to stay fast
and accessible.

---

## What was built

### Hero (`components/landing/`)
- **R3F "AI core"** (`scene.tsx`) — a breathing distorted sphere caged in a slow wireframe
  icosahedron, orbited by two emissive satellites in an instanced-sparkle field, with damped
  mouse parallax + ContactShadows. Bloom mounts only on fine-pointer devices;
  `PerformanceMonitor` sheds bloom → dpr under load (60 fps > spec sheet).
- **Split-text headline** (`split-text.tsx`) — per-word rise/rotate/blur reveal. Screen readers
  get the intact sentence (`sr-only`); the animated copy is `aria-hidden`.
- **Cursor light** — a spring-lagged radial glow trails the pointer across the hero.
- **Live HUD widgets** (`live-widgets.tsx`) — agents-online, tokens-streamed (count-up + a
  self-drawing SVG sparkline), citations, AI-drafting indicator; each floats on its own phase.
  Desktop-only (they collide with the dock on phones).
- **Physical CTAs** (`glow-button.tsx` + `magnetic.tsx`) — animated gradient, hover lift/glow,
  spring press, click ripple, ambient pulse, magnetic cursor attraction.

### Scroll experience
- **Lenis** smooth scrolling driven by GSAP's ticker (one clock for Lenis + ScrollTrigger),
  skipped under reduced motion (`smooth-scroll.tsx`).
- **Scrubbed story** (`story.tsx`) — a 320vh pinned section (CSS sticky + GSAP scrub): three
  scenes (draft → ground → ship) morph with blur/scale/fade, with per-scene flourishes
  (streaming bars, citation chips, agent nodes) and progress dots. Reduced motion gets the
  scenes stacked statically.
- **Sections** (`sections.tsx`) — tilt-card capabilities grid, count-up stats band, two-plane
  architecture cards with a drawn "JWT bridge" beam, finale CTA. `scramble-text.tsx` decodes
  section kickers on first view.
- **Scroll progress beam** + hero scroll indicator.

### Design system (`globals.css` + `theme-toggle.tsx`)
- **Light + dark themes** — dark is default; `html[data-theme="light"]` overrides the same
  custom properties, so every `vayu-*` Tailwind utility re-skins automatically. A no-flash boot
  script in `layout.tsx` applies the stored/OS preference before first paint.
- Glow/shadow/semantic token system, new keyframes (gradient-x, ripple, scroll-hint), global
  `:focus-visible` rings.

## Engineering notes (the "why")

- **three.js never touches the initial bundle** — the scene loads via `next/dynamic`
  (`ssr:false`) with a CSS-orb fallback that reserves the exact box (zero CLS). `/` stays
  statically prerendered.
- **Accessibility is a first-class path**: reduced motion ⇒ plain headline, static widgets,
  native scroll, static story, and a frozen (but rendered) 3D core; split words are
  `aria-hidden` so accessible names stay intact — the existing smoke e2e still passes untouched.
- **Bugs found by rendering, not guessing** (headless Playwright screenshots):
  1. `background-clip:text` silently breaks across transformed descendants → the gradient
     headline rendered invisible. Fix: apply the gradient **per word**.
  2. HUD cards collided with the dock at 390px → desktop-only.
  3. A frozen first screenshot exposed that background tabs suspend rAF — worth knowing when
     "verifying" animation via automation.

## Validation

| Check | Result |
|---|---|
| `next build` | ✅ compiled, `/` static |
| `vitest` | ✅ 3/3 |
| smoke e2e (real chromium, local) | ✅ 3/3 — hero accessible name preserved |
| Visual: dark / light / mobile / reduced-motion | ✅ 4 screenshot passes |
| Bundle discipline | ✅ three/gsap/lenis lazy, landing chunk only |

New deps: `three` `@react-three/fiber` `@react-three/drei` `@react-three/postprocessing`
`framer-motion` `gsap` `lenis` (+ `@types/three`).

See also: [phase-25-providers-auth-storage.md](phase-25-providers-auth-storage.md).
