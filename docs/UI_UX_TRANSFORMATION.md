# VAYU AI — UI/UX transformation report

Living record of the experience-system transformation: baseline audit, issue register, design
architecture, and the evidence for each change. Each issue keeps its ID from audit to fix.

## 1. Baseline

| | |
|---|---|
| Branch | `claude/vigilant-lovelace-0664qb`, based on `main` @ `41d4de5` (PR #5 merged). The brief suggests a separate `feat/experience-system-v2` branch, but this session is required to work on its designated branch. |
| Stack (installed) | Next 16.2.9 (App Router, Turbopack) · React 19.2.7 · TypeScript 5.9.3 · Tailwind 4.3.1 · Framer Motion 12.42.2 · GSAP 3.15.0 + ScrollTrigger · Lenis 1.3 · three 0.185 · R3F 9.6.1 · Drei 10.7.7 · postprocessing 3 · lucide-react 1.23 · Tiptap 3.27 (`@vayu/editor`) · Vitest 3.2.6 · Playwright 1.61 |
| Runtime used | Local Postgres 16 + pgvector; FastAPI AI plane (`alembic upgrade head` → 0002) with Gemini replaced by a local fake server that speaks the same HTTP API (Google is unreachable from this sandbox); Next production build (`next build` + `next start`); headless Chromium |
| Seed data (fixtures) | One user (`demo.user@example.com`), three documents, one Markdown research source |

### 1.1 Checks at baseline

| Command | Result |
|---|---|
| `pnpm -C apps/web typecheck` | ✅ pass |
| `pnpm -C apps/web test` (vitest) | ✅ 3 passed |
| `pnpm -C apps/web lint` | ❌ **broken** — `next lint` was removed in Next 16 ("Invalid project directory … /lint"); ESLint is not installed |
| `pnpm -C apps/web build` | ✅ pass |
| Playwright e2e (local prod server + Postgres) | ✅ 6/6 |
| `uv run ruff check .` / `uv run pytest -q` (apps/ai) | ✅ clean / 120 passed |

### 1.2 Lab performance (local prod build, Chromium, unthrottled, uncompressed bytes — lab data, not field data)

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

### 1.3 Visual baseline

Screenshots of all 17 routes at desktop 1440×900 and mobile 390×844, in dark and light themes, are in
[`docs/ui-ux/baseline/`](ui-ux/baseline/). Per-route metrics (HTTP status, overflow, fixed elements,
console errors) are in `route-report.json`.

- Seven routes **ignore the light theme** and stay dark: `/login`, `/editor`, `/research`, `/voice`, `/media`, `/privacy`, `/terms`.
- The fixed bottom dock (≈82 px including its offset) covers page content: the editor's copilot bar, the bottom rows of documents, and legal text on mobile.
- On mobile the dock scrolls horizontally with its scrollbar hidden, so 2–4 destinations are invisible.
- Three routes request a third-party noise image (`grainy-gradients.vercel.app`), which fails offline.

## 2. Route inventory

Access: the `proxy.ts` matcher only checks that a session **cookie exists**. Before this work, only
`/dashboard`, `/live` and `/status` validated the session on the server (`requireSession`). Every other
protected page was a client component that relied on BFF `checkPermission` (viewer = read, editor =
write, admin = manage members).

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

## 3. Issue register

`Status` is updated as work lands. P0 = broken core workflow, data loss, security, or inaccessible
primary action · P1 = major confusion, responsive, or accessibility blocker · P2 = inconsistency or
missing states · P3 = refinement.

### 3.1 Security and data integrity (fixed first, in an isolated commit)

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
| S9 | P1 | Agent streams cut every step to 800 characters, and there is no final-result event, so long answers are silently truncated (`apps/ai/app/agents/runner.py:107`) | ◐ backend fixed — new `result` frame with the full answer and a status; the UI renders it in Phase E |

### 3.2 Experience issues (summary — the full evidence lists come from the three auditors)

| ID | P | Area | Issue | Status |
|---|---|---|---|---|
| U1 | P0 | Theme | 7 routes hardcode `#050505`/black/white, so they break the light theme. Light is the default for OS-light users (`layout.tsx:12`) | open |
| U2 | P0 | Contrast | Light accent text 3.8:1, primary-button label 3.4–3.8:1, violet button labels 4.2:1; no light values for success/warning/danger (1.7–2.8:1 on white) | open |
| U3 | P0 | /docs/[id] | Save never checks the response, so failures look like success and edits are lost; an unknown id renders an editable blank document; restore has no confirmation and overwrites unsaved work | open |
| U4 | P0 | /editor | Labelled a workspace editor but never saves. Fake "Real-time collaboration active", "Context window" and "LAST_SYNC" cards; floating cards overlap and capture clicks | open |
| U5 | P0 | /voice, /media | Primary actions unreachable by keyboard (pointer-only push-to-talk; `hidden` file inputs); fake waveform; outdated "NVIDIA" copy | open |
| U6 | P0 | /agents | Final output truncated (S9); no stop; errors shown as "HTTP 502"; streams not aborted on navigation | open |
| U7 | P0 | /settings/members | Every role sees management controls, which fail with a silent 403. Remove has no confirmation. Invites are unusable because there is no workspace switching. No link to the page | open |
| U8 | P1 | Shell | One global fixed dock is the only navigation: no header, workspace context, account menu or sign-out outside the dashboard, no skip link, no `aria-current`; labels on hover only; tiles float continuously; hides destinations on phones | open |
| U9 | P1 | Shell | The dock is shown to signed-out visitors on `/`, `/privacy` and `/terms` (11 links that all bounce to login) and covers the hero scroll hint | open |
| U10 | P1 | Layout | Pages pad 40–48 px at the bottom against an ≈82 px fixed dock, so last rows sit underneath it | open |
| U11 | P1 | Copilot | Shown only on the unsaved `/editor`. "Insert" replaces the selection; no stop; errors and the "no key configured" notice can be inserted into the document | open |
| U12 | P1 | /research | Failed ask shows a blank answer with "0%"; failed URL ingest clears the input; citations untitled (`REF_[n]`, raw `SCORE:0.83`); "Confidence" is a heuristic presented as a metric; source status hidden; HUD cards overlap panels | open |
| U13 | P1 | /live | Reconnects forever when the AI plane is down or auth fails; mic button does nothing via keyboard; mobile transcript buried; "Offline" label while connecting | open |
| U14 | P1 | Landing | Fabricated claims: "v1.0", "14 modules", "7 agents online", "2.4M tokens streamed", "99.9% grounded", "claude-sonnet-4-6 streaming", "plan / research / synthesize · checkpointed"; provider count says 5 (there are 6) | open |
| U15 | P1 | Landing | Waves demo: unthrottled rAF loop (~21–37k points/frame), blocks page scroll on phones (`touchmove` `preventDefault`), black slab, no heading | open |
| U16 | P1 | Landing 3D | Renders every frame even off-screen; ContactShadows re-render each frame; no WebGL error boundary; distortion ignores reduced motion | open |
| U17 | P1 | Auth | Network error leaves the spinner forever; labels are placeholders only; no show-password; CLS 0.33 on mobile from provider buttons popping in | open |
| U18 | P1 | Performance | 815 KB editor chunk prefetched on every app page (see §1.2) | open |
| U19 | P1 | CSS | Custom utilities are unlayered, so `hover:glow*` variants never compile, the global `:focus-visible { border-radius }` squares round controls, the reduced-motion rule misses `::before` animations, and `.glass-panel:hover` lifts working surfaces (editor, forms) | open |
| U20 | P2 | Docs list | Loading reads as "No documents yet"; create has no pending state (double-click creates duplicates) | open |
| U21 | P2 | Vault | No empty, error or "search not configured" state; unlabelled raw scores; one global localStorage key that crashes on malformed data | open |
| U22 | P2 | Analytics | Failed fetch → "Loading…" forever; AI tiles count Copilot only, unlabelled; spend shown to 4 decimals | open |
| U23 | P2 | Dashboard | Raw user and workspace UUIDs, raw role values, developer copy (BFF/JWT/JWKS) and a `HTTP 200 · {json}` dump as primary content | open |
| U24 | P2 | Status | Tailwind palette literals instead of tokens; "Not checked" counted as failures; operator fixes shown to every role | open |
| U25 | P2 | Global | No error, not-found or loading boundaries; no per-route `<title>`; framer animations ignore reduced motion (no `MotionConfig`) | open |
| U26 | P2 | Legal | Dark-only; "Last updated" is the build date; boilerplate content ("non-commercial transitory viewing only") | open |
| U27 | P3 | Misc | Third-party image hotlink; invalid `rgba(var(--hex))` shadows; dead classes; three different brand marks; editor H4–H6 unstyled; drag handle invisible | open |

## 4. Design architecture (decisions)

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

## 5. Plan (gated phases)

| Phase | Scope | Exit gate |
|---|---|---|
| A | This audit | ✅ inventory, register, baseline evidence |
| S | Security fixes S1–S9, with e2e tests for cross-workspace isolation and the redirect guard | ✅ 6 e2e + 12 unit tests; each e2e test fails on the old code and passes on the fix |
| B | Tokens, fonts, CSS layer fixes, primitives, MotionConfig, error/not-found boundaries | one route uses the system in both themes; checks pass |
| C | Route groups, app header, navigation (dock + mobile bar), workspace context, skip link | every route reachable; nothing fixed covers content |
| D | Dashboard, docs, document detail (+ Copilot + history UX), scratchpad editor (lazy) | create → write → Copilot → save → history works |
| E | Research, agents (+ result event, stop), vault, analytics | contracts preserved; empty/loading/error states verified |
| F | Voice, media, Live, status, members, auth, legal | keyboard paths, mic denial, offline, reduced motion |
| G | Landing honesty, 3D performance, WebGL fallback | content clear without WebGL; budget measured |
| H | After-screenshots, axe sweep, responsive matrix, perf, full checks, report | no open P0/P1 |
