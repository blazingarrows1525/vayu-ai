"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type Turn = { id: number; heard: string; reply: string; audioUrl: string | null };
type Phase = "idle" | "requesting" | "listening" | "thinking";

const MAX_SECONDS = 60;
const HOLD_MS = 350;
const BARS = 28;

function pickMimeType(): { mime: string; ext: string } {
  const options = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" }, // Safari
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const o of options) if (MediaRecorder.isTypeSupported(o.mime)) return o;
  }
  return { mime: "", ext: "webm" };
}

function micError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow it for this site in your browser's settings, then try again.";
  if (name === "NotFoundError") return "No microphone was found. Connect one and try again.";
  if (name === "NotReadableError") return "Another app is using the microphone. Close it and try again.";
  return "The microphone couldn't be started.";
}

/**
 * Ask by voice: tap (or press Enter/Space) to start and again to send, or hold while speaking.
 * Escape cancels a recording. Each turn shows what VAYU heard and its reply, with the spoken
 * reply as a playable clip when a voice is configured.
 */
export function VoiceAssistant() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<{ text: string; status?: number } | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [seconds, setSeconds] = useState(0);
  const [autoplayId, setAutoplayId] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const discard = useRef(false);
  const pointerStart = useRef<number | null>(null);
  const skipClick = useRef(false);
  const nextId = useRef(1);

  const teardown = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (ticker.current) clearInterval(ticker.current);
    raf.current = null;
    ticker.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevels(Array(BARS).fill(0));
  }, []);

  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      teardown();
    },
    [teardown],
  );

  const send = useCallback(async (blob: Blob, ext: string) => {
    setPhase("thinking");
    try {
      const form = new FormData();
      form.append("file", blob, `question.${ext}`);
      form.append("action", "chat");
      const res = await fetch("/api/media/voice", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { transcript?: string; heard?: string | null; audio_url?: string | null; detail?: unknown; error?: unknown };
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : null;
        setError({
          status: res.status,
          text:
            res.status === 503
              ? "Voice isn't set up on the AI service yet."
              : res.status === 413
                ? "That recording was too long. Keep questions under a minute."
                : (detail ?? `VAYU couldn't answer (error ${res.status}).`),
        });
        return;
      }
      const id = nextId.current++;
      setTurns((t) => [...t, { id, heard: data.heard ?? "", reply: data.transcript ?? "", audioUrl: data.audio_url ?? null }]);
      setAutoplayId(id);
    } catch {
      setError({ text: "Couldn't reach VAYU. Check your connection and try again." });
    } finally {
      setPhase("idle");
    }
  }, []);

  const start = useCallback(async () => {
    if (phase !== "idle") return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError({ text: "This browser can't record audio here. Voice needs a secure (https) connection and a recent browser." });
      return;
    }
    setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const { mime, ext } = pickMimeType();
      const rec = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        teardown();
        if (discard.current) {
          discard.current = false;
          setPhase("idle");
          return;
        }
        void send(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }), ext);
      };
      recorder.current = rec;
      rec.start();

      // Live level meter from the microphone itself.
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      ctx.createMediaStreamSource(media).connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(bins);
        const step = Math.max(1, Math.floor(bins.length / BARS));
        setLevels(Array.from({ length: BARS }, (_, i) => (bins[i * step] ?? 0) / 255));
        raf.current = requestAnimationFrame(draw);
      };
      draw();

      const began = Date.now();
      setSeconds(0);
      ticker.current = setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS && rec.state === "recording") rec.stop();
      }, 250);
      setPhase("listening");
    } catch (err) {
      teardown();
      setPhase("idle");
      setError({ text: micError(err) });
    }
  }, [phase, send, teardown]);

  const stop = useCallback((cancel = false) => {
    if (recorder.current?.state !== "recording") return;
    discard.current = cancel;
    recorder.current.stop();
  }, []);

  useEffect(() => {
    if (phase !== "listening") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, stop]);

  // Pointer: a quick tap toggles, a press-and-hold records until release.
  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || phase === "requesting" || phase === "thinking") return;
    skipClick.current = true;
    if (phase === "idle") {
      pointerStart.current = Date.now();
      void start();
    } else if (phase === "listening") {
      pointerStart.current = null;
      stop();
    }
  }
  function onPointerUp() {
    if (pointerStart.current !== null && Date.now() - pointerStart.current > HOLD_MS) stop();
    pointerStart.current = null;
  }
  function onClick() {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (phase === "idle") void start();
    else if (phase === "listening") stop();
  }

  const listening = phase === "listening";
  const busy = phase === "requesting" || phase === "thinking";
  const status =
    phase === "requesting"
      ? "Waiting for microphone permission…"
      : listening
        ? `Listening · ${seconds}s. Press again (or let go, if holding) to send; Esc cancels.`
        : phase === "thinking"
          ? "Thinking…"
          : "Press the microphone and ask a question, or hold it while you speak.";

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Microphone" className="surface flex flex-col items-center gap-5 rounded-2xl px-5 py-8">
        <button
          type="button"
          aria-pressed={listening}
          aria-label={listening ? "Stop and send" : "Start speaking"}
          // aria-disabled, not disabled: a disabled button drops keyboard focus mid-flow
          // (while the browser asks for the microphone, or while VAYU thinks).
          aria-disabled={busy || undefined}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          className={cn(
            "relative grid h-24 w-24 touch-none select-none place-items-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100 aria-disabled:cursor-wait aria-disabled:opacity-60",
            listening
              ? "border-vayu-danger bg-vayu-danger/15 text-vayu-danger"
              : "border-vayu-accent/50 bg-vayu-accent/10 text-vayu-accent hover:bg-vayu-accent/20",
          )}
        >
          {busy ? <Spinner className="h-8 w-8" /> : listening ? <Square aria-hidden className="h-8 w-8" /> : <Mic aria-hidden className="h-9 w-9" />}
        </button>
        <div aria-hidden className="flex h-10 items-center gap-[3px]">
          {levels.map((v, i) => (
            <span
              key={i}
              className={cn("w-1.5 rounded-full transition-[height] duration-75", listening ? "bg-vayu-accent" : "bg-vayu-border-strong/40")}
              style={{ height: `${Math.max(4, Math.round(v * 40))}px` }}
            />
          ))}
        </div>
        <p role="status" className="max-w-md text-center text-sm text-vayu-muted">
          {status}
        </p>
      </section>

      {error && (
        <Notice tone="danger">
          {error.text}
          {error.status === 503 && (
            <>
              {" "}
              <Link href="/status" className="font-medium underline underline-offset-2">
                Service status
              </Link>{" "}
              shows how to add a key.
            </>
          )}
        </Notice>
      )}

      {turns.length === 0 ? (
        <EmptyState
          icon={<Mic />}
          title="Ask anything out loud"
          description="VAYU transcribes your question, answers in a sentence or two, and speaks the reply when a voice is configured. Questions aren't saved."
        />
      ) : (
        <section aria-label="Conversation" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden className="h-3.5 w-3.5" />} onClick={() => setTurns([])}>
              Clear conversation
            </Button>
          </div>
          <ol className="flex flex-col gap-3">
            {turns.map((t) => (
              <li key={t.id} className="flex flex-col gap-2">
                <div className="self-end rounded-2xl rounded-br-md border border-vayu-accent/25 bg-vayu-accent/10 px-4 py-2.5 text-sm text-vayu-fg sm:max-w-[80%]">
                  <span className="sr-only">You said: </span>
                  {t.heard || <span className="text-vayu-muted">(Nothing was recognised.)</span>}
                </div>
                <div className="surface self-start rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed text-vayu-fg sm:max-w-[85%]">
                  <span className="sr-only">VAYU replied: </span>
                  <p className="whitespace-pre-wrap">{t.reply}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {t.audioUrl ? (
                      <audio controls src={t.audioUrl} autoPlay={t.id === autoplayId} className="h-9 max-w-full" />
                    ) : (
                      <span className="text-xs text-vayu-subtle">Text-only reply (no voice configured).</span>
                    )}
                    <CopyButton value={t.reply} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
