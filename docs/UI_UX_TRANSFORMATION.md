# VAYU AI — UI/UX transformation report

The record of the experience-system transformation: what was found, what changed, how it was verified
and what is still open. Issue IDs (S1–S9, U1–U28) stay the same from audit to fix.

## 1. Executive summary

The web app now runs on one design system and one signed-in shell, and each route was rebuilt around
the task people use it for.

- **Security first.** Workspace-isolation, mass-assignment, role-rank and open-redirect defects were
  fixed in an isolated commit, each proven by an e2e test that fails on the old code (S1–S9).
- **One visual system.** Dark and light tokens with computed WCAG AA contrast, Geist type, and shared
  primitives. All 17 routes follow both themes; seven previously stayed dark-only.
- **Navigation.** A server-guarded shell with workspace switching, which is what makes member invites
  usable, plus a still, grouped desktop dock and a phone tab bar with a "More" sheet.
- **Workflows that fail safely.**
  - Documents autosave, show what the server actually stored, and recover edits after a failure.
  - Restores are confirmed and keep a backup.
  - Copilot and agents can be stopped, and errors can't be inserted into a document.
  - Research answers say what they're based on.
  - Voice and Live work from the keyboard.
- **Honest landing page.** Invented metrics are gone; the numbers left are counted from code, and a
  unit test keeps them in sync.
- **Measured (lab, local production build):**
  - Landing LCP 2524 → about 300 ms (desktop); JS on `/dashboard` 1813 → 591 KB.
  - Layout shift on sign-in, editor and mobile Live is now 0.000–0.002.
  - axe reports 0 violations across 51 page states.
  - 39 e2e, 32 unit and 124 Python tests pass, and the broken lint script works again.

Still open (§18): a legal review of the policy wording, testing on real devices and screen readers,
Safari and Firefox, and HawkScan (no API key in this environment).

## 2. Repository commit and branch tested

| | |
|---|---|
| Base | `main` @ `41d4de5` (PR #5 merged) |
| Branch | `claude/vigilant-lovelace-0664qb` (the session's designated branch; the brief suggests `feat/experience-system-v2`) |
| Commits | `23bf924` audit (A) · `040146d` security (S) · `e10e2d4` design system (B) · `38b284a` shell (C) · `e7e4c3e` documents (D) · `796ea08` research, agents, vault, analytics (E) · `53942be` voice, media, Live, status, members, sign-in, legal (F) · `ffdf0e0` landing (G) · the QA commit with this report (H) |

| Phase | Scope | Exit gate and evidence |
|---|---|---|
| A | This audit | ✅ inventory, register, baseline evidence |
| S | Security fixes S1–S9, with e2e tests for cross-workspace isolation and the redirect guard | ✅ 6 e2e + 12 unit tests; each e2e test fails on the old code and passes on the fix |
| B | Tokens, fonts, CSS layer fixes, primitives, MotionConfig, error/not-found boundaries | ✅ `/docs` on the shared system in dark/light × desktop/mobile; typecheck, 20 unit, build and 15 e2e pass |
| C | Route groups, app header, navigation (dock + mobile bar), workspace context, skip link | ✅ all 13 signed-in routes reachable from both navs; nothing fixed covers content; 18 e2e pass (shell, phone sheet, invite → switch → JWT) |
| D | Dashboard, docs, document detail (+ Copilot + history UX), scratchpad editor (lazy) | ✅ create → write → Copilot → save → history verified in `documents.spec.ts` (8 tests); 26 e2e + 28 unit pass; mobile document CLS 0.000 |
| E | Research, agents (+ result event, stop), vault, analytics | ✅ API contracts unchanged (BFF hardening only: validation, abort, readable errors); states verified in `intelligence.spec.ts` (4 tests); 30 e2e + 28 unit pass |
| F | Voice, media, Live, status, members, auth, legal | ✅ keyboard voice and Live (fake mic, real AI plane), Live offline → Retry, members roles, sign-in recovery, legal contrast: `workspace-tools.spec.ts` (8); 38 e2e + 28 unit + 31 AI media tests pass |
| G | Landing honesty, 3D performance, WebGL fallback | ✅ hero complete without WebGL (screenshot in `docs/ui-ux/phase-g/`); budget measured (re-run in §13); 39 e2e + 32 unit pass |
| H | Full regression, accessibility sweep, visual and runtime matrix, performance, lint repair, report | ✅ no open P0/P1 (§6); all checks in §16 pass |

## 3. Existing stack and architecture

| | |
|---|---|
| Branch | `claude/vigilant-lovelace-0664qb`, based on `main` @ `41d4de5` (PR #5 merged). The brief suggests a separate `feat/experience-system-v2` branch, but this session is required to work on its designated branch. |
| Stack (installed) | Next 16.2.9 (App Router, Turbopack) · React 19.2.7 · TypeScript 5.9.3 · Tailwind 4.3.1 · Framer Motion 12.42.2 · GSAP 3.15.0 + ScrollTrigger · Lenis 1.3 · three 0.185 · R3F 9.6.1 · Drei 10.7.7 · postprocessing 3 · lucide-react 1.23 · Tiptap 3.27 (`@vayu/editor`) · Vitest 3.2.6 · Playwright 1.61 |
| Runtime used | Local Postgres 16 + pgvector; FastAPI AI plane (`alembic upgrade head` → 0002) with Gemini replaced by a local fake server that speaks the same HTTP API (Google is unreachable from this sandbox); Next production build (`next build` + `next start`); headless Chromium |
| Seed data (fixtures) | One user (`demo.user@example.com`), three documents, one Markdown research source |

Two planes, unchanged by this work:

- **Product plane** (`apps/web`, Next.js). Better Auth sessions, Drizzle/Postgres, RBAC, server-rendered
  pages, and BFF routes under `app/api/*`. These mint a short-lived EdDSA JWT for every AI call.
- **Intelligence plane** (`apps/ai`, FastAPI). RAG over pgvector, LangGraph agents, Copilot SSE, voice
  and video, the Live WebSocket and diagnostics. It verifies the JWT through JWKS and trusts nothing else.

After this work the app router has three areas:

- `app/(app)/*`: every signed-in route, behind one server-guarded layout with the shell.
- `app/(auth)/login`: sign-in and sign-up.
- Public pages: `/`, `/privacy`, `/terms`.

## 4. Route inventory

Access: the `proxy.ts` matcher only checks that a session **cookie exists**. Before this work, only
`/dashboard`, `/live` and `/status` validated the session on the server (`requireSession`). Every other
protected page was a client component that relied on BFF `checkPermission` (viewer = read, editor =
write, admin = manage members). Since Phase C every signed-in route sits in the `(app)` route group,
whose layout validates the session on the server for each request.

| Route | Purpose / primary task | Data / APIs | States present → missing | Theme | Priority |
|---|---|---|---|---|---|
| `/` | Explain the product and lead into the workspace | static (hardcoded claims) | FallbackOrb, reduced-motion story → WebGL error fallback, no-JS content | tokens (3D hex, black Waves slab) | P1 |
| `/login`, `/signup` | Sign in / create an account (email + configured OAuth) | `/api/auth-providers`, Better Auth | spinner, OAuth error map → visible labels, show password, network-error recovery, `role=alert`; signup still says "Welcome back" | **dark-only** | P0 |
| `/dashboard` | Workspace home | session + membership (server); `GET /api/ai/agents` ping | ping pending → workspace name, next actions, recent work; leads with raw UUIDs and a JSON dump | tokens | P1 |
| `/docs` | Find / create documents | `GET/POST /api/documents` | empty → loading, error, create pending; "No documents yet" flashes while loading | tokens | P1 |
| `/docs/[id]` | Edit, comment, snapshot, diff, restore | doc, comments, versions, diff, restore APIs | "Loading…", "Saving…" → not-found, save result, dirty state, read-only for viewers, pending states, restore confirmation | diff + code blocks dark-only | **P0** |
| `/editor` | Scratch editor with Copilot (never saved) | `POST /api/ai/copilot` (SSE) | streaming → save, stop, readable errors; fake status cards | **dark-only** | **P0** |
| `/research` | Add sources, ask grounded questions, inspect citations | sources, upload, ingest-url, ask | busy labels → source status, ask/URL errors, citation titles | **dark-only** | P1 |
| `/agents` | Run an agent and watch its steps | `GET /api/ai/agents`, `POST /api/agents/stream` (SSE) | running → final result, stop, done state, list loading/error | tokens | **P0** |
| `/vault` | Semantic search, related sources, saved searches | vault search / related, localStorage | "Searching…" → empty, not-configured, error | tokens | P2 |
| `/analytics` | Workspace writing + AI usage | `GET /api/analytics` | loading → error (stays on "Loading…" forever) | tokens | P2 |
| `/voice` | Push-to-talk Q&A | `POST /api/media/voice` | listening/processing → keyboard path, real waveform, user transcript, replay | **dark-only** | **P0** |
| `/media` | Video → summary | `POST /api/media/video` | spinner → keyboard file pick, size check, error vs result, retry | **dark-only** | **P0** |
| `/live` | Realtime voice + text conversation | `GET /api/realtime/session` → WS `/v1/ws/chat` | rich state machine → bounded reconnect, keyboard mic, mobile transcript | tokens | P1 |
| `/status` | Explain what blocks AI features | `GET /api/diagnostics` | complete; uses non-token colours; "not checked" counted as failures | literals | P2 |
| `/settings/members` | Invite / change roles / remove | members APIs | invite message → loading, empty, pending, confirmation, role gating; no inbound link | tokens | **P0** |
| `/privacy`, `/terms` | Legal text | static | — ; light theme renders at 1.08:1 contrast; "Last updated" = build date | **dark-only** | **P0** |

There are no `loading.tsx`, `error.tsx` or `not-found.tsx` files anywhere, and only `/status` sets a page title.

What each route does now is in §10.

## 5. Before-state observations

### 5.1 Checks at baseline

| Command | Result |
|---|---|
| `pnpm -C apps/web typecheck` | ✅ pass |
| `pnpm -C apps/web test` (vitest) | ✅ 3 passed |
| `pnpm -C apps/web lint` | ❌ **broken** — `next lint` was removed in Next 16 ("Invalid project directory … /lint"); ESLint is not installed |
| `pnpm -C apps/web build` | ✅ pass |
| Playwright e2e (local prod server + Postgres) | ✅ 6/6 |
| `uv run ruff check .` / `uv run pytest -q` (apps/ai) | ✅ clean / 120 passed |

### 5.2 Lab performance at baseline (local prod build, Chromium, unthrottled, uncompressed bytes — lab data, not field data)

| Route | Viewport | LCP | CLS | Long tasks (first ~4 s) | JS loaded |
|---|---|---|---|---|---|
| `/` | desktop | 2524 ms | 0.000 | 33 (8369 ms) | 3170 KB |
| `/` | mobile | 1996 ms | 0.000 | 37 (5951 ms) | 3168 KB |
| `/login` | desktop / mobile | 268 / 196 ms | **0.117 / 0.329** | 0 | 766 KB |
| `/dashboard` | desktop | 280 ms | 0.000 | 2 (183 ms) | **1813 KB** |
| `/editor` | desktop / mobile | 668 / 528 ms | 0.059 / **0.155** | 3 | 1781 KB |
| `/research` | desktop | 344 ms | 0.001 | 2 | 1781 KB |
| `/live` | desktop / mobile | 236 / 176 ms | 0.001 / **0.252** | 20–39 (~2.9 s) | 3079 KB |

Bundle finding: an **815 KB Tiptap/ProseMirror chunk loads on `/dashboard` and `/docs`**, which render no
editor. The floating dock links to `/editor` from every page, and production link prefetching pulls that
route's chunk. `/login` has no dock and doesn't load it.

### 5.3 Visual baseline

Screenshots of all 17 routes at desktop 1440×900 and mobile 390×844, in dark and light themes, are in
[`docs/ui-ux/baseline/`](ui-ux/baseline/). Per-route metrics (HTTP status, overflow, fixed elements,
console errors) are in `route-report.json`.

- Seven routes **ignore the light theme** and stay dark: `/login`, `/editor`, `/research`, `/voice`, `/media`, `/privacy`, `/terms`.
- The fixed bottom dock (≈82 px including its offset) covers page content: the editor's copilot bar, the bottom rows of documents, and legal text on mobile.
- On mobile the dock scrolls horizontally with its scrollbar hidden, so 2–4 destinations are invisible.
- Three routes request a third-party noise image (`grainy-gradients.vercel.app`), which fails offline.

## 6. Prioritized issues and evidence

`Status` is updated as work lands. P0 = broken core workflow, data loss, security, or inaccessible
primary action · P1 = major confusion, responsive, or accessibility blocker · P2 = inconsistency or
missing states · P3 = refinement.

### 6.1 Security and data integrity (fixed first, in an isolated commit)

| ID | P | Issue (evidence) | Status |
|---|---|---|---|
| S1 | P0 | `PATCH /api/documents/[id]` spreads the raw JSON body into the Drizzle `.set()`, so an editor can write `workspaceId`, `createdBy` or `isArchived`. It always returns `{ok:true}` (`lib/data.ts:55-63`, `api/documents/[id]/route.ts:19-25`) | ✅ fixed — field whitelist; 404 when nothing was updated |
| S2 | P0 | Comments GET/POST never check that the document is in the caller's workspace (`api/documents/[id]/comments/route.ts:10,22`; `lib/data.ts:68`) | ✅ fixed — document ownership checked first; mentions limited to workspace members |
| S3 | P0 | Comment PATCH resolves any comment by id, ignoring the document and workspace (`comments/route.ts:32-40`; `lib/data.ts:108`) | ✅ fixed — resolve requires the comment to belong to that document |
| S4 | P0 | Versions GET lists another workspace's snapshots (`versions/route.ts:10`; `lib/data.ts:211`) | ✅ fixed |
| S5 | P0 | Restore returns another workspace's snapshot **content**, even though its scoped UPDATE changes 0 rows (`lib/data.ts:229-244`) | ✅ fixed — scoped; restore now snapshots the current content first (`Before restoring vN`); atomic version numbering |
| S6 | P0 | Members API: `role` is not validated and role ranks are never compared. An admin can grant `owner`, promote themselves, or demote or remove the owner; there is no last-owner guard (`api/members/**`; `lib/rbac.ts` `ROLE_RANK` unused) | ✅ fixed — assignable roles = admin/editor/viewer; actors grant and manage only lower ranks; no self-changes; owner untouchable |
| S7 | P1 | Conversation messages are scoped to the workspace, not the user, and `role` is unvalidated (`api/conversations/[id]/messages/route.ts`) | ✅ fixed — conversation must belong to the caller; role ∈ user/assistant |
| S8 | P0 | Open redirect after email sign-in. The guard only rejects `//`; `/\evil.com` and `/%09/evil.com` (decoded to a tab, then stripped by the URL parser) resolve off-origin (`components/auth-form.tsx:44-46,115`) | ✅ fixed — `lib/safe-redirect.ts` (same-origin parse) |
| S9 | P1 | Agent streams cut every step to 800 characters, and there is no final-result event, so long answers are silently truncated (`apps/ai/app/agents/runner.py:107`) | ✅ fixed — backend `result` frame (S) rendered as the full answer by the agents page (E) |

### 6.2 Experience issues (summary — the full evidence lists come from the three auditors)

| ID | P | Area | Issue | Status |
|---|---|---|---|---|
| U1 | P0 | Theme | 7 routes hardcode `#050505`/black/white, so they break the light theme. Light is the default for OS-light users (`layout.tsx:12`) | ✅ fixed in F — every route follows the theme. The sign-in page's desktop brand panel stays dark in both themes on purpose (it frames a dark illustration); the form side is themed |
| U2 | P0 | Contrast | Light accent text 3.8:1, primary-button label 3.4–3.8:1, violet button labels 4.2:1; no light values for success/warning/danger (1.7–2.8:1 on white) | ✅ fixed — tokens computed ≥ 4.5:1 for every text pair (B), and every route now uses them (C–G) |
| U3 | P0 | /docs/[id] | Save never checks the response, so failures look like success and edits are lost; an unknown id renders an editable blank document; restore has no confirmation and overwrites unsaved work | ✅ fixed in D — server-rendered page (unknown or other-workspace id → 404 inside the shell); autosave 1.2 s after typing and on Ctrl/⌘+S, one save at a time, status from the actual response; a local backup survives failed saves, reloads and in-app navigation and is offered back; snapshot/restore wait for pending saves; restore is confirmed and keeps a backup; viewers get a read-only page (`documents.spec.ts`) |
| U4 | P0 | /editor | Labelled a workspace editor but never saves. Fake "Real-time collaboration active", "Context window" and "LAST_SYNC" cards; floating cards overlap and capture clicks | ✅ fixed in D — renamed Scratchpad with honest copy; drafts kept in this browser per user; **Save as document**; fake status cards, tilt and the noise hotlink removed |
| U5 | P0 | /voice, /media | Primary actions unreachable by keyboard (pointer-only push-to-talk; `hidden` file inputs); fake waveform; outdated "NVIDIA" copy | ✅ fixed in F — voice: tap, hold or keyboard (Enter/Space; Esc cancels), a level meter from the real microphone, each turn shows what was heard (new additive `heard` field in the AI plane, with a test) and the reply with visible audio controls; Safari-compatible recording; 60 s cap; copy no longer claims NVIDIA. Media: keyboard file picker and drop, type and size checks, error kept apart from the result with Retry, save the summary as a document |
| U6 | P0 | /agents | Final output truncated (S9); no stop; errors shown as "HTTP 502"; streams not aborted on navigation | ✅ fixed in E — the full answer from the `result` frame; Stop aborts the request and, through the BFF (`req.signal`), the run; readable errors instead of "HTTP 502"; runs abort on navigation; steps named in plain language; results can be copied or saved as a document |
| U7 | P0 | /settings/members | Every role sees management controls, which fail with a silent 403. Remove has no confirmation. Invites are unusable because there is no workspace switching. No link to the page | ✅ fixed in F (with C) — server-rendered and role-aware: only admins/owners see invite and manage controls, limited to members ranked below them and roles they may grant; removal is confirmed; invite errors say what to do; a role guide |
| U8 | P1 | Shell | One global fixed dock is the only navigation: no header, workspace context, account menu or sign-out outside the dashboard, no skip link, no `aria-current`; labels on hover only; tiles float continuously; hides destinations on phones | ✅ fixed in C — server-guarded `(app)` layout; header with workspace switcher, module label, theme and account menu (members, status, sign out); still, grouped dock with labels on hover and keyboard focus and `aria-current`; phones get 4 pinned tabs + a "More" sheet listing every module |
| U9 | P1 | Shell | The dock is shown to signed-out visitors on `/`, `/privacy` and `/terms` (11 links that all bounce to login) and covers the hero scroll hint | ✅ fixed in C — module navigation exists only inside the signed-in shell (`smoke.spec.ts`) |
| U10 | P1 | Layout | Pages pad 40–48 px at the bottom against an ≈82 px fixed dock, so last rows sit underneath it | ✅ fixed in C — every signed-in page pads by `--nav-clearance` (6 rem + safe area); Live's composer sits above the phone tab bar and home indicator |
| U11 | P1 | Copilot | Shown only on the unsaved `/editor`. "Insert" replaces the selection; no stop; errors and the "no key configured" notice can be inserted into the document | ✅ fixed in D — Copilot in every document; labelled controls; a scope line that says what it will act on; Stop aborts the request and the upstream generation; errors and placeholder (no-key) output can't be inserted; Replace selection vs Insert below; Markdown replies become real blocks (`lib/markdown-to-doc.ts`, 7 unit tests) |
| U12 | P1 | /research | Failed ask shows a blank answer with "0%"; failed URL ingest clears the input; citations untitled (`REF_[n]`, raw `SCORE:0.83`); "Confidence" is a heuristic presented as a metric; source status hidden; HUD cards overlap panels | ✅ fixed in E — a failed ask keeps the question and says why; a bad URL keeps what was typed with an inline error; citations name their source and passage, with similarity explained as 0–1; the heuristic "confidence" meter is replaced by "based on N passages from M sources"; explicit no-match and no-model states; source status badges; keyboard file picker plus drag and drop; HUD cards and the hotlink removed |
| U13 | P1 | /live | Reconnects forever when the AI plane is down or auth fails; mic button does nothing via keyboard; mobile transcript buried; "Offline" label while connecting | ✅ fixed in F — reconnects stop after 5 attempts (~30 s) with the reason, a Retry and a Service status link; an auth rejection (close 1008) is final; the mic works from the keyboard and keeps focus; "Connecting…" instead of "Offline"; a tap that fails to start no longer leaves the mic latched; a smaller orb on phones keeps the transcript in view |
| U14 | P1 | Landing | Fabricated claims: "v1.0", "14 modules", "7 agents online", "2.4M tokens streamed", "99.9% grounded", "claude-sonnet-4-6 streaming", "plan / research / synthesize · checkpointed"; provider count says 5 (there are 6) | ✅ fixed in G — every invented figure removed ("v1.0", "14 modules", "7 agents online", "2.4M tokens streamed", "99.9% grounded", the model name, "checkpointed", "— free", "infinitely scalable"); the remaining numbers (6 providers, 7 agents, 7 file formats) come from `lib/product.ts`, which a unit test checks against the AI plane's code; HUD cards describe capabilities instead of faking live metrics; an e2e test guards against the old claims |
| U15 | P1 | Landing | Waves demo: unthrottled rAF loop (~21–37k points/frame), blocks page scroll on phones (`touchmove` `preventDefault`), black slab, no heading | ✅ fixed in G — the Waves demo is removed with `simplex-noise` and an orphaned `wave-background.tsx` |
| U16 | P1 | Landing 3D | Renders every frame even off-screen; ContactShadows re-render each frame; no WebGL error boundary; distortion ignores reduced motion | ✅ fixed in G — the scene stops rendering off-screen (0 draw calls in 2 s after scrolling away), bakes its shadow once, starts at DPR 1, renders a single frame under reduced motion (distortion frozen), and falls back to a static core on phones, Data Saver, missing WebGL, a lost context or a scene error. Landing JS 3170 → ~1.3–1.6 MB desktop and 3168 → ~0.3–0.5 MB mobile; LCP 2524 → 308 ms desktop and 1996 → 144 ms mobile (hero copy now paints on first render) |
| U17 | P1 | Auth | Network error leaves the spinner forever; labels are placeholders only; no show-password; CLS 0.33 on mobile from provider buttons popping in | ✅ fixed in F — providers computed on the server (login CLS 0.329 → 0.000 on mobile), visible labels, show-password, autocomplete hints, network errors recover, sign-up has its own heading, signed-in visitors are sent on to their destination, hotlink removed |
| U18 | P1 | Performance | 815 KB editor chunk prefetched on every app page (see §1.2) | ✅ fixed in D — the editor is a lazy chunk (`components/editor/lazy-editor.tsx`): JS on /dashboard 1813 → 591 KB, /research 1781 → 734 KB; only pages that render the editor load it |
| U19 | P1 | CSS | Custom utilities are unlayered, so `hover:glow*` variants never compile, the global `:focus-visible { border-radius }` squares round controls, the reduced-motion rule misses `::before` animations, and `.glass-panel:hover` lifts working surfaces (editor, forms) | ✅ fixed in B — `@utility` / `@layer components`; the focus ring keeps each control's radius; reduced motion covers pseudo-elements; only `.surface-interactive` lifts |
| U20 | P2 | Docs list | Loading reads as "No documents yet"; create has no pending state (double-click creates duplicates) | ✅ fixed in B — server-rendered list (no false empty state), skeleton `loading.tsx`, one create action that stays busy until the editor opens, read-only view for viewers; e2e `experience.spec.ts` |
| U21 | P2 | Vault | No empty, error or "search not configured" state; unlabelled raw scores; one global localStorage key that crashes on malformed data | ✅ fixed in E — initial, empty, loading and error states; labelled similarity; saved searches per workspace, validated on read (corrupt storage is ignored) and removable |
| U22 | P2 | Analytics | Failed fetch → "Loading…" forever; AI tiles count Copilot only, unlabelled; spend shown to 4 decimals | ✅ fixed in E — server-rendered (no endless "Loading…"); AI figures labelled as Copilot usage, with what isn't metered stated; cost via `formatUsd` |
| U23 | P2 | Dashboard | Raw user and workspace UUIDs, raw role values, developer copy (BFF/JWT/JWKS) and a `HTTP 200 · {json}` dump as primary content | ✅ fixed in D — welcome, four start actions, recent documents, workspace (name, role, members) and an AI-service check that calls no model; IDs moved into a "Technical details" disclosure |
| U24 | P2 | Status | Tailwind palette literals instead of tokens; "Not checked" counted as failures; operator fixes shown to every role | ✅ fixed in F — tokens and shared primitives; "Not checked" is its own status (`skip`) and no longer counted as a problem; fixes inline (with copy) for admins and owners, behind a disclosure for others |
| U25 | P2 | Global | No error, not-found or loading boundaries; no per-route `<title>`; framer animations ignore reduced motion (no `MotionConfig`) | ✅ fixed — error, not-found and global-error boundaries (app-wide and inside the shell); every route sets its own `<title>` through the `%s · VAYU AI` template; `MotionConfig reducedMotion="user"` |
| U26 | P2 | Legal | Dark-only; "Last updated" is the build date; boilerplate content ("non-commercial transitory viewing only") | ◐ F — themed, readable in light (e2e asserts > 4.5:1) and dated by the text's last change (3 July 2026); the boilerplate wording itself needs a legal review (§ remaining risks) |
| U27 | P3 | Misc | Third-party image hotlink; invalid `rgba(var(--hex))` shadows; dead classes; three different brand marks; editor H4–H6 unstyled; drag handle invisible | ◐ — hotlinks removed; one brand mark (unique gradient ids per instance); editor H4–H6, drag handle, code blocks and callouts fixed; the remaining `react-hooks` compiler-readiness warnings are listed in §16 |
| U28 | P3 | Global | Both `<html>` and `<body>` painted the page colour, so on short pages body's box hid the fixed aurora/grid layers and left a hard horizontal edge where content ended (found in B) | ✅ fixed in B — only `<html>` paints it |

Exit gate: **no P0 or P1 issue is open.** U26 (legal wording, P2) and U27 (P3 cleanup) are partly done;
see §18.

## 7. Design principles and visual direction

1. **Visual direction — "Aero-Intelligence."** Keep the existing ink-navy palette, sky/cyan accent and
   violet secondary, but fix contrast: light-theme accent `#0369a1`, light status tokens, violet never
   used as a button fill under white text, and a stronger input border token. Typography moves from
   `system-ui` to **Geist Sans / Geist Mono**: self-hosted through `next/font` from the `geist` npm
   package (OFL 1.1), with tabular numerals for metrics and mono for traces and identifiers.
2. **Surfaces.** Glass is reserved for navigation chrome, Live and landing hero moments. Working surfaces
   (editors, forms, transcripts, tables) are solid token surfaces that **don't move on hover**; only
   interactive cards lift.
3. **Shell.** Route groups split three shells:
   - `(app)` — authenticated, server-guarded once in a layout. It renders an app header (workspace,
     section, theme, account menu with Members, Status and Sign out) and module navigation: a refined
     dock on desktop (no idle motion, grouped, labels on hover *and* focus, `aria-current`), and on
     phones a 5-item bottom bar with a "More" sheet.
   - Live keeps its own chrome but stays inside the guard and the navigation.
   - Public pages (`/`, legal, auth) get no app dock.
   - Workspace context: the session's `activeWorkspaceId` (a column the schema already had) is set by
     `PUT /api/workspaces/active` (members only; any other id is a 404). Page data, `checkPermission`
     and the JWT minted for the intelligence plane all resolve through it, falling back to the
     personal workspace if the user is removed. Menus use the native popover API, and the phone
     "More" sheet uses a modal `<dialog>`: dismissal, top layer and focus order come from the browser,
     with no menu library.
4. **Primitives** (`components/ui/`): Button / LinkButton / IconButton, Field + Input / Textarea /
   Select, Card / Panel, Badge / StatusDot, EmptyState / Notice / Skeleton / Spinner,
   PageHeader / PageContainer, Disclosure / CopyButton, ConfirmDialog on native `<dialog>`, Tabs.
   They're only built where the same behaviour recurs. No new UI library: native `<dialog>` gives focus
   trapping, Escape and backdrop.
5. **Motion governance.**
   - Framer Motion handles component transitions; GSAP + Lenis only the landing narrative; R3F the 3D
     scenes; CSS the hover, focus and simple keyframes.
   - A global `MotionConfig reducedMotion="user"` gates framer animations; the CSS reduced-motion rule
     also covers pseudo-elements.
   - No continuous motion on navigation or working surfaces.
6. **Honesty.** No invented metrics. Landing numbers come from the code; the dashboard and analytics
   show only API data, with explicit empty, unavailable and error states.
7. **Performance.**
   - The editor is lazy-loaded inside its pages, so prefetching a route no longer pulls 815 KB.
   - The landing scene pauses off-screen, renders shadows once, starts at DPR 1, skips WebGL on
     small screens and `saveData`, and falls back to a static core when the WebGL context fails.

## 8. Token inventory and changes

Defined in `app/globals.css`. Dark is the default; `html[data-theme="light"]`
overrides the same custom properties, so every `vayu-*` utility re-skins at runtime.

| Token | Dark | Light | Role |
|---|---|---|---|
| `bg` / `surface` / `elevated` / `inset` | `#060912` / `#0e1521` / `#131c2b` / `#0a101b` | `#f4f7fc` / `#ffffff` / `#ffffff` / `#f6f8fc` | page, cards, dialogs, inputs |
| `border` / `border-strong` | `#1c2738` / `#526888` | `#d9e2ef` / `#7d90a8` | decorative separation / input boundary (≥ 3:1) |
| `fg` / `muted` / `subtle` | `#e6edf6` / `#8aa0bd` / `#7a8ea9` | `#0c1220` / `#55677f` / `#5f7086` | body, secondary, tertiary text |
| `accent` / `on-accent` | `#38bdf8` / `#04121c` | `#0369a1` / `#ffffff` | primary action, links, focus ring |
| `violet` | `#a78bfa` | `#6d28d9` | secondary emphasis — never a fill under white text |
| `success` / `warning` / `danger` | `#34d399` / `#fbbf24` / `#f87171` | `#065f46` / `#92400e` / `#b91c1c` | status |

Computed WCAG ratios for every text pair the primitives render (badge text on its 10 % tint, notice
body on its tint, tabs, dialog text, button labels), on both `bg` and `surface`: dark ≥ 5.46:1,
light ≥ 4.71:1 (lowest: `subtle` on `bg`). Light success/warning started at `#047857`/`#b45309`, which
gave badges 4.09–4.45:1, so they were darkened to the values above.

Type: Geist Sans and Geist Mono (variable, self-hosted by `next/font/local` from the `geist`
package) with a small scale on top of Tailwind's: `text-display` (fluid hero), `text-page` (h1),
`text-section` (h2), `text-overline`. Motion tokens: `ease-standard`, `ease-emphasis`, `ease-exit`;
`--duration-fast/base/slow` = 120/200/320 ms.

## 9. Component architecture and ownership

`components/ui/*` holds presentational primitives that never fetch data. Route folders own data, state
and API calls. The primitives are built only where the same interaction contract recurs.

| Component (file) | Contract |
|---|---|
| `Button`, `LinkButton` (`ui/button.tsx`) | Variants primary/secondary/ghost/danger and sizes sm/md/lg. `loading` disables the button, sets `aria-busy` and shows a spinner. Coarse pointers get 40–44 px targets |
| `IconButton`, `Tooltip` (`ui/icon-button.tsx`) | A label is required (it is the accessible name). The tooltip appears on hover after a delay and on `:focus-visible`. `pressed` maps to `aria-pressed` |
| `Field`, `Input`, `Textarea`, `Select` (`ui/field.tsx`) | Visible label, description and error wired through `aria-describedby`. Errors use `role=alert` and `aria-invalid` |
| `Card`, `Panel` (`ui/card.tsx`) | Solid working surfaces. Only `interactive` cards lift |
| `Badge`, `StatusDot` (`ui/badge.tsx`) | Status always comes with text; colour only reinforces it |
| `Notice`, `EmptyState`, `Skeleton`, `Loading` (`ui/feedback.tsx`) | `danger` uses `role=alert`, others `status`, and static guidance `note`. Skeletons are paired with a hidden status |
| `PageContainer`, `PageHeader` (`ui/page.tsx`) | One `h1`, consistent gutters, bottom padding that clears the navigation |
| `Disclosure` (`ui/disclosure.tsx`) | Native `<details>` |
| `CopyButton` (`ui/copy-button.tsx`) | Clipboard with a fallback, confirmed in place and to screen readers |
| `ConfirmDialog` (`ui/confirm-dialog.tsx`) | Native modal `<dialog>`: focus trap, Escape, backdrop. Cancel gets initial focus; can't be dismissed while pending |
| `Tabs`, `TabPanel` (`ui/tabs.tsx`) | ARIA tabs with a roving tab stop. Hidden panels stay mounted, so a stream survives switching |
| `Popover` (`ui/popover.tsx`) | Native popover API: light dismiss and top layer. Keyboard opening moves focus in; Escape returns it |
| Shell (`components/shell/*`) | `AppHeader`, `WorkspaceSwitcher`, `AccountMenu`, `AppNav` (dock, tab bar, More sheet) and `BrandMark`. Built from one nav config (`lib/nav.ts`) |
| `LazyEditor` (`components/editor/lazy-editor.tsx`) | The Tiptap editor as its own chunk, with a same-size skeleton |
| `CopilotPanel` + `useCopilot` | Shared by the document page and the scratchpad. Stop uses an AbortController |
| Helpers (`lib/*`) | `cn`, `format` (timeAgo, plural, formatUsd), `markdown-to-doc`, `sse`, `save-as-document`, `product` (code-derived facts), `safe-redirect` and `rbac` (incl. `ROLE_LABEL`) |

## 10. Page-by-page design decisions

| Route | Decision (and the problem it removes) |
|---|---|
| `/` | Honest copy and code-derived numbers. The 3D core pauses off-screen and falls back to a static core. Hero copy paints on first render. The Waves demo is gone. Footer added (U14–U16) |
| `/login` | Server-rendered: providers come from the server (no layout jump) and signed-in visitors are sent on. Visible labels, show-password, network-error recovery, its own sign-up heading. Themed form beside a dark brand panel (U17) |
| `/dashboard` | Welcome, four start actions, recent documents, workspace facts and a cheap AI-service check; IDs moved into a disclosure (U23) |
| `/docs` | Server-rendered list, skeleton, one create action that resists double clicks, read-only view for viewers (U20) |
| `/docs/[id]` | Real 404. Autosave with a status taken from the response. Local backup and recovery. Copilot, Comments and History tabs. Confirmed restore with a backup; accessible diff; read-only for viewers (U3, U11) |
| `/editor` | Scratchpad: honest copy, drafts kept per user in this browser, "Save as document" (U4) |
| `/research` | Keyboard and drop upload with validation. A URL field that keeps its input. Source status badges. "Based on N passages from M sources" instead of a confidence meter; titled citations; no-match and no-model states; save an answer as a document (U12) |
| `/agents` | Agent cards, a task field, Run and a real Stop. Steps in plain language, the full result, and states for "step limit" and "no model" (U6, S9) |
| `/vault` | Search with initial, empty and error states. Related sources. Saved searches per workspace that survive corrupt storage (U21) |
| `/analytics` | Server-rendered, with figures labelled for what they count (Copilot usage, cost via `formatUsd`) (U22) |
| `/voice` | Tap, hold or keyboard to talk. Real level meter. Shows what was heard and the reply, with visible audio controls. Safari-friendly recording (U5) |
| `/media` | Keyboard and drop picking, type and size checks, errors apart from results with Retry, save the summary as a document (U5) |
| `/live` | Bounded reconnects, then an offline state with its reason and Retry. Keyboard mic that keeps focus. "Connecting…" label. A stable header so nothing jumps when the socket opens (U13) |
| `/status` | Tokens. "Not checked" is its own state, not a failure. Fixes shown inline to admins and owners, behind a disclosure for others (U24) |
| `/settings/members` | Role-aware controls (only lower ranks and lower roles), confirmed removal, actionable invite errors, a role guide (U7) |
| `/privacy`, `/terms` | Themed and readable, dated by the text's last change. Wording unchanged, pending legal review (U26) |
| Shell (all signed-in routes) | Header with workspace, module, theme and account. Grouped dock or phone tab bar with More. Skip link; every page clears the nav (U8–U10) |

## 11. Motion and 3D architecture

- **Ownership.** Framer Motion handles component transitions, GSAP + Lenis only the landing story,
  R3F the two scenes (landing core, Live orb), and CSS hovers, focus and simple keyframes.
- **Reduced motion.** `MotionConfig reducedMotion="user"` covers Framer animations. The CSS rule
  (`*, ::before, ::after`) stops keyframes. The landing scene renders a single frame, with distortion
  and float frozen. Under `prefers-reduced-motion` the landing page has 0 infinite animations
  (matrix run, §16).
- **No idle motion where people work.** The dock, cards and working surfaces don't float. Only
  explicitly interactive cards lift.
- **Content that must be seen paints on the first frame.** Entrances are position-only. This took
  landing LCP from 2.2 s to 0.3 s and mobile Live's from 1.3 s to 0.27 s.
- **Landing scene lifecycle:**
  - `frameloop` switches to `never` while off-screen (0 draw calls in 2 s after scrolling away).
  - `ContactShadows frames={1}` bakes the shadow once.
  - DPR starts at 1; `PerformanceMonitor` raises it on capable devices and sheds bloom first.
  - A static CSS core replaces WebGL on phones, Data Saver, missing WebGL, a lost context or a scene
    error (error boundary). Those visitors never download three.js.

## 12. Accessibility decisions

- **Keyboard.**
  - A skip link is the first tab stop; every page has one `main#main` and one `h1` (the document
    page's is visually hidden, since its title is an editable field).
  - Every control is reachable and operable by keyboard: file pickers are real buttons, and the voice
    and Live microphones respond to Enter and Space, with Escape to cancel.
  - The mic buttons use `aria-disabled` instead of `disabled` while busy, so focus isn't dropped.
- **Focus.** A 2 px accent ring follows each control's radius. Tooltips appear on `:focus-visible`,
  not only on hover. Native dialogs and popovers trap focus and return it.
- **Screen readers.**
  - Landmarks: banner, main and the `Modules` navigation, plus `aria-current` on the active module.
  - Labelled fields with described errors.
  - Live regions for save status, streaming output, Copilot results and run status.
  - Diffs announce `[added: …]` and `[removed: …]`; the scrambled landing text has a real text
    equivalent.
- **Contrast.** Computed for every token pair in both themes (§8). An e2e test asserts more than 4.5:1
  for legal text in light theme.
- **Touch.** Coarse pointers get 40–44 px targets for buttons, icon buttons, tabs and navigation.
- **Automated sweep.** axe-core 4.10.2 with WCAG 2.0, 2.1 and 2.2 A/AA rules, across 17 routes ×
  (desktop dark, desktop light, mobile dark), found **0 violations** after fixing one: `aria-label`
  on a role-less span. This supplements manual checks; it doesn't replace them.
- **Not done here:** manual NVDA, VoiceOver or TalkBack passes (§18).

## 13. Performance budget and measured results

Budget: LCP ≤ 2.5 s and CLS ≤ 0.1 on every route. The editor chunk loads only where an editor renders,
and phones get no WebGL.

The table is lab data: the same script before and after, on a local production build with headless
Chromium, unthrottled and with uncompressed bytes. Single runs vary by roughly ±100 ms, and landing JS
varies with how many lazy chunks load inside the 4 s window. It is not field data.

| Route | Viewport | LCP before → after | CLS before → after | JS before → after |
|---|---|---|---|---|
| `/` | desktop | 2524 → 292–308 ms | 0.000 → 0.000 | 3170 → 1318–2042 KB |
| `/` | mobile | 1996 → 144–192 ms | 0.000 → 0.000 | 3168 → 266–838 KB (no three.js) |
| `/login` | desktop / mobile | 268 / 196 → 248 / 124 ms | **0.117 / 0.329 → 0.000 / 0.000** | 766 → 246 / 305 KB |
| `/dashboard` | desktop / mobile | 280 / 156 → 260–412 / 168 ms | 0.000 → 0.000 | **1813 → 591 KB** |
| `/editor` | desktop / mobile | 668 / 528 → 276 / 208 ms | 0.059 / **0.155 → 0.000 / 0.000** | 1781 → 1691 KB (renders the editor) |
| `/docs/[id]` | mobile | n/a | 0.620 (regression found in D) → 0.000 | 1708 KB (renders the editor) |
| `/research` | desktop / mobile | 344 / 184 → 212 / 192 ms | 0.001 / 0.013 → 0.000 / 0.014 | 1781 → 610 KB |
| `/live` | desktop / mobile | 236 / 176 → 236–364 / 272 ms | 0.001 / **0.252 → 0.001 / 0.002** | 3079 → 1885 KB |

Landing long tasks dropped from 8.4 s to about 4.5 s on desktop and from 5.95 s to 0.11–0.17 s on
mobile in the first 4 seconds. The desktop figure is dominated by SwiftShader software WebGL in this
headless sandbox and isn't representative of devices with a GPU.

## 14. API and contract preservation

- **No breaking change** to any endpoint path or response shape, the SSE frames, the WebSocket
  protocol, provider selection, rate limits or storage. No database migration was added.
- **Additive changes:**
  - The agents SSE stream gained a `result` frame `{status, output}` (S9).
  - Voice chat responses gained an optional `heard` field; `transcript` still carries the reply.
  - Diagnostics `CheckStatus` gained `skip`, consumed only by the status board.
  - New BFF routes: `GET /api/workspaces` and `PUT /api/workspaces/active` (members only; other ids
    return 404).
  - Better Auth exposes the existing `session.active_workspace_id` column. Page data,
    `checkPermission` and the intelligence-plane JWT (`workspace_id`, `role`) all honour it, falling
    back to the personal workspace.
- **Hardening that rejects bad input that used to be accepted:**
  - Document PATCH writes only the whitelisted fields.
  - Comments, versions and restore are scoped to the caller's workspace.
  - Member changes respect role rank.
  - Agent and Copilot requests are validated, return readable 502s, and forward client aborts
    upstream (`req.signal`).
- `/api/analytics` and `/api/auth-providers` still exist, though their pages now compute on the server.

## 15. Files changed and why

From `41d4de5` through the landing commit: 187 files, +10,036/−3,289 lines (the QA commit adds this
report, the lint setup and the fixes in §16).

| Group | Files |
|---|---|
| Design system | `app/globals.css` (tokens, layers, utilities, dialog/popover/sheet, reduced motion and transparency), `components/ui/*`, `components/motion-provider.tsx`, `lib/cn.ts`, Geist |
| Shell and navigation | `app/(app)/layout.tsx`, `error.tsx`, `not-found.tsx`, `components/shell/*`, `components/theme-toggle.tsx`, `lib/nav.ts`, `lib/workspace.ts`, `lib/session.ts`, `lib/auth.ts`, `app/api/workspaces/*`; removed `components/floating-dock.tsx` |
| Routes | Every page under `app/(app)/*`, `app/(auth)/*`, `app/privacy`, `app/terms`, `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`; new route components (document workspace, comments, history, scratchpad, agents console, research center, vault search, members manager, AI status, voice assistant, video summarizer, status board, auth panel, legal page) |
| Shared logic | `lib/use-copilot.ts`, `lib/markdown-to-doc.ts`, `lib/sse.ts`, `lib/save-as-document.ts`, `lib/format.ts`, `lib/product.ts`, `lib/safe-redirect.ts`, `lib/rbac.ts`, `lib/data.ts`, `lib/diagnostics.ts`, `components/editor/lazy-editor.tsx` |
| 3D and motion | `components/landing/{hero,scene,sections,story,live-widgets,split-text,scramble-text}.tsx`, `components/live/live-console.tsx`; removed `components/demo.tsx`, `components/ui/wave-background.tsx` and `simplex-noise` |
| Editor package | `packages/editor/src/{editor.tsx,styles.css}` (H4–H6, drag handle, code blocks and callouts in both themes, reserved height) |
| Backend (additive) | `apps/ai/app/agents/{graph,runner}.py` (`result` frame), `apps/ai/app/api/v1/media.py` (`heard`); BFF routes under `app/api/*` (§14) |
| Tests | e2e: `security`, `experience`, `shell`, `documents`, `intelligence`, `workspace-tools`, updated `smoke` and `auth`, plus the shared `helpers.ts`. Unit: `safe-redirect`, `format`, `markdown-to-doc`, `product`. Python: `test_agent_loop.py`, `test_gemini_media.py` |
| Tooling | `apps/web/eslint.config.mjs` and the `lint` script (ESLint 9 + `eslint-config-next` 16) |
| Docs | this report; `docs/ui-ux/{baseline,phase-b…phase-g,after}/` |

## 16. Commands executed and results

Final run, on the QA commit.

| Command | Result |
|---|---|
| `pnpm -C apps/web typecheck` | ✅ pass |
| `pnpm -C apps/web lint` (`eslint .`) | ✅ 0 errors, 17 warnings. The warnings are eslint-plugin-react-hooks v6 React Compiler readiness rules (`set-state-in-effect`, `refs`, `immutability`, `purity`), kept as warnings on purpose |
| `pnpm -C apps/web test` (vitest) | ✅ 5 files, 32 tests |
| `pnpm -C apps/web build` (placeholder `DATABASE_URL` and `BETTER_AUTH_SECRET`) | ✅ pass |
| Playwright e2e: local production server, Postgres 16, the real AI plane with a stand-in Gemini HTTP server, Chromium's fake microphone | ✅ 39/39, run twice back-to-back |
| `uv run pytest -q` (apps/ai) | ✅ 124 passed (120 at baseline) |
| `uv run ruff check .` (apps/ai) | ✅ clean |
| axe-core 4.10.2: 17 routes × 3 configurations | ✅ 0 violations |
| Visual and runtime matrix: 17 routes × 4 viewports (1440, 1280, 768, 360) × 2 themes | ✅ 136 captures with no horizontal overflow, no console errors, no 404s and no hydration or key warnings. One finding (no `h1` on the document page) was fixed. 0 infinite animations under reduced motion |
| Lab performance re-run (§13) | ✅ every measured route is within budget |
| HawkScan DAST | ❌ not run: no `HAWK_API_KEY` or `hawk` CLI in this environment |

## 17. Visual evidence

- `docs/ui-ux/baseline/` holds the before state: 17 routes at desktop and mobile in both themes, plus
  `route-report.json`.
- `docs/ui-ux/phase-b/` … `phase-g/` hold per-phase evidence: the `/docs` system pages, the shell and
  menus, the document page and dashboard, research and agents, voice and members, and the landing page
  with and without WebGL.
- `docs/ui-ux/after/` holds contact sheets of all 17 routes at `wide`, `laptop`, `tablet` and `phone`
  in dark and light, the landing page under reduced motion, and `route-report.json` (status, overflow,
  console errors, missing assets and `h1` count per capture).

## 18. Known limitations and next steps

**Limitations**

- **Browsers.** Checked in Chromium only. The menus use the native popover API and `:has()`. Safari
  17+ and current Firefox support both; older Safari would need a fallback.
- **Assistive technology.** Tested only through axe and keyboard e2e tests; no manual screen-reader
  pass.
- **Performance.** Lab numbers on localhost only; no field data, no real devices.
- **Legal text.** The policy wording is boilerplate ("non-commercial transitory viewing only") and
  needs a legal review. Only its presentation changed.
- **HawkScan** couldn't run (no API key).
- **Product limits:**
  - The chosen workspace lasts for the session and isn't remembered at the next sign-in.
  - Copilot's model list is static; providers without a key fail with a clear message.
  - Comment mentions exist in the API but not in the interface.
  - Document drafts are backed up per browser only.
- **Lint.** The 17 compiler-readiness warnings are deliberate and listed in §16.

**Next steps, by user impact**

1. Deploy to Render and re-run the e2e journeys against production, including real Google and GitHub
   sign-in.
2. Run VoiceOver, NVDA and TalkBack passes and check on real phones, including Safari on iOS.
3. Remember the last workspace across sign-ins.
4. Get a legal review of the privacy policy and terms.
5. Add field performance monitoring (Web Vitals) to confirm the lab gains.
6. Migrate the warned hook patterns before adopting the React Compiler.
7. Run HawkScan once a key is configured.
