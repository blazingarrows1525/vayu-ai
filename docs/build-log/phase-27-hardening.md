# Phase 27 — Multimodal & agent hardening

**Status:** ✅ Local checks green (ruff · pytest 94 · vitest · `next build` · smoke e2e 3/3)

Phase 26 was followed by a burst of unlogged feature work (July 3–11). This phase documents
that work, then fixes the security and correctness problems a review of it turned up. No new
features — every change makes something that already shipped safe or actually work.

---

## What landed between Phase 26 and 27 (previously undocumented)

| Commit | Change |
|---|---|
| `ba66e04` `973c9c4` `095a78a` | NVIDIA NIM provider: chat (`meta/llama-3.1-405b-instruct`), embeddings (`nv-embedqa-e5-v5`, the `.env.example` default), rerank, OCR model; voice (Riva STT via gRPC) and video (ffmpeg keyframes + Llama 3.2 Vision) pipelines |
| `64973a0` `080212c` `bcd6b1c` | Content safety via NemoGuard (`llama-3.1-nemoguard-8b-content-safety`) on voice input/output; fails open |
| `50c3485` | `WS /v1/ws/chat` — auth-first-message WebSocket for text/voice chat (no UI consumes it yet) |
| `ee97d7c` | Agents rewritten from plan→research→synthesize into a **ReAct tool-calling loop** (`search_wikipedia`, `calculator`) |
| `8f6c139` `f39f978` `e668b21` | `/voice` push-to-talk assistant, `/media` video intelligence, copilot model picker |
| `b6b85d8` `040a7b0` `4f48a94` | CI/ruff fixes, glassbox panel UI, only render configured OAuth buttons |

> Those commits were titled "Phase 9" / "Phase 13", reusing numbers from the original plan.
> This log is the canonical record for them.

## What this phase fixed

### 1 · Media endpoints were unauthenticated (security)
`POST /v1/media/voice` and `/v1/media/video` had no `get_principal` dependency, and the AI
service is publicly reachable on Render. Anyone could burn NVIDIA/OpenAI credits, and — given a
workspace UUID — inject content into that workspace's RAG. The BFF's catch-all
`/api/proxy/[[...path]]` forwarded a session *cookie* the AI plane never reads.

- Both endpoints now require the JWT and take the workspace + author from the **principal**;
  the `workspace_id` form field is gone (the UI sent `"default"`, which crashed `uuid.UUID()` in
  ingest — so voice/video also 500'd for real users whenever a transcript existed).
- The open-ended proxy is replaced by `app/api/media/[kind]/route.ts`: allow-listed
  (`voice` | `video`), `document:write` RBAC, mints the service JWT like every other BFF route,
  and forwards 4xx/503 reasons to the UI.
- Uploads are capped by `MAX_UPLOAD_MB` (413), same as RAG ingest; `action` is validated
  (`transcribe` | `chat`).

### 2 · Arbitrary file write + local file read via uploads (security)
- `VideoService` wrote the upload to `tmpdir / <client filename>` — `/app/...` or `../../...`
  escaped the temp dir. Uploads now land at `input<sanitized-ext>` (`services/ffmpeg.safe_upload_path`).
- ffmpeg follows references inside HLS playlists: an upload named `x.m3u8` made ffmpeg read
  arbitrary container files (reproduced locally — it pulled a local WAV into the output; text files
  like `/proc/self/environ` are reachable with known tricks, and frames go to the vision model).
  `services/ffmpeg.run_ffmpeg` now pins `-protocol_whitelist file` and a `-format_whitelist` of
  real containers (mov/mp4, matroska/webm, avi, ogg, wav, mp3, flac, aac, flv, mpegts), adds
  `-nostdin`, and checks the exit code. Both voice STT and video use it.

### 3 · Agent calculator could freeze the AI service (DoS)
`calculator` used `eval()` behind a character filter that allowed `9**9**9**9`, and tools ran
synchronously on the event loop — one prompt could stall every request on the worker. It now
walks a parsed AST (numbers + `+ - * / // % **` only) with bounded exponents (≤100), magnitudes
(≤1e100) and length (≤500). Tools run via `asyncio.to_thread`, concurrently.

### 4 · Agents crashed on the default provider
`AnthropicProvider.chat()` raised `NotImplementedError`, and Anthropic is the default in
`config.py` — so agents 500'd locally (prod survives because Render sets Gemini). Now:
- Real Anthropic tool calling: OpenAI-style history/tools are converted to Messages API shape
  (`_to_anthropic_messages` / `_to_anthropic_tool`); consecutive tool results are batched into
  one user turn; only a completed `tool_use` turn is executed (a `max_tokens` cut can carry
  partial input); refusals return a readable message.
- `chat()` returns a `ChatTurn`; Anthropic's raw assistant content (`provider_content`) is
  replayed verbatim next turn so thinking blocks round-trip unchanged on models that emit them.
  OpenAI-compatible providers strip that key before sending.
- The loop is capped at `MAX_TOOL_ROUNDS = 6` (a `give_up` node explains the stop) instead of
  relying on LangGraph's recursion error.
- A failing run is persisted as `failed` (was stuck at `running`), and the SSE stream emits an
  `error` step the Agent Command Center already renders.

### 5 · Voice chat 500'd when TTS failed
TTS called `audio.speech.create(model="nvidia/tts")` on NVIDIA's OpenAI-compatible endpoint, which
likely doesn't exist. TTS now prefers OpenAI (`tts-1`, WAV) when `OPENAI_API_KEY` is set, and
synthesis is **best-effort** everywhere: on failure the reply is returned text-only
(`audio_url: null`); the WebSocket chat follows the same rule. Empty transcripts get a "didn't catch that" reply instead of an LLM call;
`LLMUnavailable` → 503, `LLMError` → 502. Video errors (undecodable / vision failure) → 422
instead of ingesting the failure text into RAG as a "summary".

### 6 · Web polish
- `/voice` and `/media` added to the `proxy.ts` auth guard (were reachable signed-out).
- Copilot model picker: removed the retired `claude-3-5-sonnet-20240620` id; added
  **Workspace default** (now the default — was NVIDIA 405B), and "Claude" now means the
  configured `DEFAULT_CHAT_MODEL` rather than a hardcoded id.
- Pricing table gained the current Claude 5-family models for cost estimation.

---

## Verification

| Check | Result |
|---|---|
| `uv run ruff check .` (ai) | ✅ clean |
| `uv run pytest -q` (ai) | ✅ **94 passed** (+41: `test_media.py`, `test_agent_loop.py`) |
| `pnpm -C apps/web build` | ✅ compiled; `/api/proxy/*` gone, `/api/media/[kind]` added |
| `pnpm -C apps/web test` | ✅ 3 passed |
| Smoke e2e (local prod server, Chromium) | ✅ 3/3 |
| Manual: signed-out `GET /voice`, `/media` | ✅ 307 → `/login?redirect=…` |
| Manual: signed-out `POST /api/media/voice` / unknown kind | ✅ 401 / 404 |

New tests cover: auth on both media endpoints, 503/413/422 paths, the spoofed `workspace_id`
field, TTS provider choice + text-only degradation, upload-path containment, ffmpeg refusing an
HLS playlist while still decoding real media (skipped if ffmpeg is absent), calculator bounds,
the ReAct loop end-to-end with a scripted provider, the round cap, error frames, Anthropic
message/tool conversion, and `AnthropicProvider.chat` against a stubbed SDK client.

Not exercised here (needs live keys): NVIDIA Riva STT, NVIDIA vision summarization, real
Anthropic tool calls.

## Open decisions (yours)

- **Voice chat writes every question into the knowledge base** (existing behaviour, kept). If
  that's not wanted, ingest only for `action=transcribe`.
- **Safety check fails open** when NemoGuard errors (existing, deliberate for availability).
- **Default chat model**: `config.py` defaults to `claude-sonnet-4-6`, while `LOGIC.md` says
  `claude-opus-4-8`; prod uses Gemini. Pick one and align config + docs.
- **`WS /v1/ws/chat`** has no client yet — wire it into `/voice` for streaming, or remove it.

See also: [phase-26-web-experience.md](phase-26-web-experience.md).
