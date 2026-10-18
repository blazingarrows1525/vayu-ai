# Phase 28 — VAYU Live (realtime WebSocket UI) + Gemini-first

**Status:** ✅ Local checks green (ruff · pytest 109 · vitest · `next build` · Playwright 6/6 incl.
authenticated journeys on real Postgres) · `/live` driven end to end in Chromium (fake mic + fake
OpenAI-compatible provider) and visually checked in dark / light / mobile / reduced-motion

Three product decisions from review, implemented:

1. **Stick to Gemini — it's cheap.** Gemini is the code default, failover is cheapest-first, and
   latency-bound voice replies use Gemini 2.5 Flash.
2. **Voice chat questions aren't knowledge.** Only `action=transcribe` ingests into RAG now.
3. **Give the WebSocket a frontend** — VAYU Live, with a 3D audio-reactive core.

---

## 1 · Gemini-first, cheapest-first

- `default_llm_provider = "gemini"` in `config.py` (was `anthropic`; only Render overrode it).
- `PROVIDER_ORDER` = gemini → groq → nvidia → openai → openrouter → anthropic, so a missing or
  failing Gemini key never silently escalates to the priciest provider.
- New `LIVE_CHAT_MODEL` (default `gemini-2.5-flash`) via `llm.live_llm_kwargs()`: used by the
  voice REST endpoint and VAYU Live whenever `GEMINI_API_KEY` is set — short spoken replies are
  latency-bound, and Flash is ~4× cheaper than Pro. Text features keep `GEMINI_CHAT_MODEL`.
- Copilot picker: "Workspace default (Gemini)", plus explicit Gemini 2.5 Flash / Pro.

## 2 · VAYU Live

### Protocol (`apps/ai/app/api/v1/ws.py`)
`auth` → `ready{stt,tts}` → per turn: `transcript` (voice) · `token`… · `audio` (best-effort TTS)
· `error{retract?}` · **`done`** (every turn ends with it, so the UI always knows). Also:
- rolling 6-turn conversation memory per socket (a fresh socket = a fresh conversation);
- malformed frames, bad base64, oversized audio (`MAX_UPLOAD_MB`), unknown types → a turn-level
  `error` + `done`; the socket stays open. `ping` → `pong` for heartbeats;
- per-user **turn rate limit** (`LIVE_TURNS_PER_MIN`, default 20) — the HTTP limiter never saw
  WebSocket messages, and each turn costs tokens;
- `speak:false` skips TTS (mute = no TTS spend); output flagged by safety is **retracted**;
- audio MIME → filename extension (`live.webm`/`.m4a`/`.ogg`) — STT providers infer the codec
  from it; JWKS verification runs in a thread (it's blocking I/O).

### BFF (`app/api/realtime/session`)
A route handler can't relay a WebSocket, so the browser connects to the AI plane directly. This
route returns `{url, token}`: the public `wss://…/v1/ws/chat` (`AI_PUBLIC_URL`, falling back to
`AI_SERVICE_URL`) and the user's 15-minute JWT, which is sent as the first frame (the same token
Better Auth already serves at `/api/auth/token`). Signed-out → 401.

### UI (`/live` — `components/live/*`, `lib/live/*`)
- **Voice core** (R3F, lazy-loaded): a distorted sphere inside a 64-bar **circular spectrum
  halo** (bass at six o'clock, mirrored like a voice print) and two gyroscope rings. Everything
  reads a shared audio meter in `useFrame` — the mic's analyser while listening, the reply's
  playback analyser while speaking, decaying token pulses while text streams — so audio never
  re-renders React. Modes ease between palettes: idle (blue/violet), listening (pink), thinking
  (violet comet sweeping the halo), speaking (cyan), offline (slate). Hover swells it; **click
  the orb to talk**. Bloom on fine pointers; `PerformanceMonitor` sheds it under load.
- **Talking:** hold the mic (or **Space**) to talk, release to send; a quick tap latches
  (tap again to send). Talking over a reply stops it (barge-in); Esc silences. 60s cap.
- **Transcript:** streaming bubbles with a caret, voice-tagged user turns with typing dots
  until the transcript lands, retracted replies shown as flagged, notices for errors.
- **Chrome:** status pill (Connecting / Live / Reconnecting / Offline), Voice in/out capability
  chips, mute, new conversation, theme toggle; magnetic + spring hover buttons; suggestion chips.
- **Resilience:** exponential-backoff reconnect with a fresh token each time, 25s heartbeat,
  "connection dropped mid-reply" notice; 401 → "sign in again" instead of looping.
- **A11y / perf:** reduced motion renders a still core and static UI; `aria-live` status +
  transcript; three.js stays out of the initial bundle (CSS-orb fallback reserves the box).

## 3 · Bugs found and fixed along the way

- **`Permissions-Policy: microphone=()` disabled the mic site-wide** — including our own pages,
  so `/voice` push-to-talk could never work in a browser. Now `microphone=(self)`.
- **CSP blocked voice playback and WebSockets:** no `media-src` (the `data:` audio replies fell
  back to `default-src 'self'`), and `connect-src https:` doesn't cover `wss:` (CSP3 scheme
  matching). Added `media-src 'self' data: blob:` and `wss: ws://localhost:*`.
- **`position: sticky` is inert app-wide** because `html, body { overflow-x: hidden }` makes
  `body` a scroll container — the Live layout fits the viewport on desktop and pins the
  composer with `fixed` on mobile instead.
- **The dock overflowed phones** (9 icons ≈ 464px > 390px) — it now scrolls horizontally on
  small screens with slightly smaller icons; "Live" added.
- No favicon (a 404 on every page) — added `app/icon.svg`.
- The e2e suite is at Better Auth's limit of **3 sign-ups / 10s / IP**; the Live checks were
  folded into an existing authenticated journey (documented in `auth.spec.ts`).

## Verification

| Check | Result |
|---|---|
| `ruff` · `pytest` (ai) | ✅ clean · **109 passed** (+14 `test_ws_live.py`, +1 provider default) |
| `next build` · `vitest` | ✅ · 3 passed |
| Playwright (local prod server + Postgres 16) | ✅ **6/6** — smoke + authenticated, incl. Live session token + console |
| Live journey (Chromium, fake mic, fake OpenAI-compatible STT/LLM/TTS) | ✅ real Better Auth JWT verified via JWKS; text turn streams → TTS → `done`; held-mic turn → real webm → transcript → reply using history → TTS → orb "Speaking"; no console errors / CSP violations |
| Layout | ✅ composer clears the dock at 1280×800 and 390×844; no horizontal overflow on mobile |
| Visual | ✅ dark, light, mobile, reduced-motion; listening / thinking / speaking states |

Not exercised here: real Gemini / NVIDIA / OpenAI calls (no keys in this environment).

## Deploy notes

- Render: nothing new is required — `AI_SERVICE_URL` is already the public `https://` URL, so
  the browser gets `wss://…`. Render web services support WebSockets.
- Docker Compose: `AI_PUBLIC_URL` defaults to `http://localhost:8787` (the published AI port).
- Voice in needs `NVIDIA_API_KEY` or `OPENAI_API_KEY`; spoken replies need `OPENAI_API_KEY`
  (the chips on `/live` show what's configured). Text Live works with just `GEMINI_API_KEY`.

See also: [phase-27-hardening.md](phase-27-hardening.md) · [PROVIDERS.md](../PROVIDERS.md).
