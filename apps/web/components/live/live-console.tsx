"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AudioLines, Mic, RotateCcw, SendHorizontal, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Magnetic } from "@/components/landing/magnetic";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLiveAudio } from "@/lib/live/use-live-audio";
import { useLiveSession, type LiveMessage, type LiveStatus } from "@/lib/live/use-live-session";
import type { OrbMode } from "./live-orb";

/** three.js stays out of the initial bundle; the fallback reserves the orb's box. */
const LiveOrb = dynamic(() => import("./live-orb"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <div className="animate-pulse-glow h-1/2 w-1/2 rounded-full bg-gradient-to-br from-vayu-accent/25 to-vayu-violet/25 blur-sm" />
    </div>
  ),
});

const SUGGESTIONS = [
  "What can you help me with?",
  "Explain retrieval-augmented generation in one breath",
  "Give me a punchy opening line for a blog post",
  "Quiz me on something interesting",
];

const MODE_LABEL: Record<OrbMode, string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  offline: "Offline",
};

const TAP_THRESHOLD_MS = 280;

function isTypingTarget(el: EventTarget | null) {
  return (
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  );
}

export function LiveConsole() {
  const reduced = useReducedMotion();
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const {
    meter, recording, speaking, ensureContext, play, stopPlayback, startRecording, stopRecording,
  } = useLiveAudio();
  const session = useLiveSession({
    onAudio: (b64) => {
      if (!mutedRef.current) void play(b64);
    },
    onToken: () => {
      meter.current.pulse = Math.min(1, meter.current.pulse + 0.35);
    },
  });
  const { sendAudio, sendText } = session;
  const [draft, setDraft] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [latched, setLatched] = useState(false); // tap-to-talk (vs hold-to-talk)
  const pressedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);

  const ready = session.status === "ready";
  const canTalk = ready && !session.busy && session.caps.stt;
  const speakReplies = session.caps.tts && !muted;

  const mode: OrbMode = !ready
    ? "offline"
    : recording
      ? "listening"
      : speaking || session.streaming
        ? "speaking"
        : session.busy
          ? "thinking"
          : "idle";

  // ── talking ────────────────────────────────────────────────────────────
  const finishTalking = useCallback(async () => {
    setLatched(false);
    const clip = await stopRecording();
    if (clip) sendAudio(clip.data, clip.mime, speakReplies);
  }, [stopRecording, sendAudio, speakReplies]);

  const beginTalking = useCallback(async () => {
    setMicError(null);
    try {
      await startRecording(() => void finishTalking());
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Couldn't open the microphone.");
    }
  }, [startRecording, finishTalking]);

  const onMicDown = (e: React.PointerEvent) => {
    if (!canTalk && !recording) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (latched) {
      void finishTalking(); // second tap sends
      return;
    }
    pressedAt.current = performance.now();
    void beginTalking();
  };

  const onMicUp = () => {
    if (!pressedAt.current) return; // this press was the "send" tap of a latched recording
    const held = performance.now() - pressedAt.current;
    pressedAt.current = 0;
    if (held < TAP_THRESHOLD_MS) setLatched(true); // quick tap → keep listening until next tap
    else void finishTalking(); // hold-to-talk → release sends
  };

  const toggleFromOrb = () => {
    if (recording) void finishTalking();
    else if (canTalk) {
      setLatched(true);
      void beginTalking();
    }
  };

  // Hold Space to talk (when not typing); Esc silences a reply.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopPlayback();
      if (e.code !== "Space" || e.repeat || isTypingTarget(e.target)) return;
      if (e.target instanceof HTMLButtonElement) return; // Space activates focused buttons
      e.preventDefault();
      if (recording && latched) void finishTalking();
      else if (canTalk && !recording) void beginTalking();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      if (recording && !latched) void finishTalking();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [beginTalking, canTalk, finishTalking, latched, recording, stopPlayback]);

  // ── typing ─────────────────────────────────────────────────────────────
  const submit = (text: string) => {
    const clean = text.trim();
    if (!clean || !ready || session.busy) return;
    ensureContext(); // unlock audio playback inside this gesture
    stopPlayback();
    if (sendText(clean, speakReplies)) setDraft("");
  };

  const toggleMute = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    if (next) stopPlayback();
  };

  // keep the newest message in view
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [session.messages, reduced]);

  const hint = !ready
    ? session.fatal ?? "Connecting to the intelligence plane…"
    : !session.caps.stt
      ? "Voice input isn't configured on this server — type below."
      : recording
        ? latched
          ? "Listening — tap the mic again to send"
          : "Listening — release to send"
        : touch
          ? "Hold the mic to talk · tap to toggle · or type below"
          : "Hold the mic or Space to talk · tap to toggle · or type below";

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-4 pb-[13rem] pt-6 sm:px-6 lg:h-[100dvh] lg:min-h-0 lg:pb-28">
      {/* ── header ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent hover:text-vayu-accent-2"
          >
            VAYU AI
          </Link>
          <span className="text-vayu-border">/</span>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            <span className="text-gradient">Live</span>
          </h1>
          <StatusPill status={session.status} />
        </div>
        <div className="flex items-center gap-2">
          <CapChip on={session.caps.stt} label="Voice in" />
          <CapChip on={session.caps.tts} label="Voice out" />
          <IconButton
            label={muted ? "Unmute spoken replies" : "Mute spoken replies"}
            onClick={toggleMute}
            disabled={!session.caps.tts}
            active={!muted && session.caps.tts}
          >
            {muted || !session.caps.tts ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </IconButton>
          <IconButton label="New conversation" onClick={() => { stopPlayback(); session.reset(); }}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
          <ThemeToggle />
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ── the orb ──────────────────────────────────────────────── */}
        <section aria-label="VAYU voice core" className="flex flex-col items-center justify-center">
          {/* radial mask: the canvas edge (bloom changes its alpha) never reads as a box */}
          <div className="relative aspect-square w-[min(100%,22rem)] [mask-image:radial-gradient(closest-side,#000_72%,transparent)] lg:w-[min(100%,34rem,calc(100dvh_-_21rem))]">
            <LiveOrb mode={mode} meter={meter} onActivate={toggleFromOrb} />
          </div>
          <div className="-mt-4 flex h-8 items-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.p
                key={mode}
                initial={reduced ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduced ? undefined : { opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.25 }}
                className={`text-sm font-semibold uppercase tracking-[0.3em] ${
                  mode === "idle" ? "text-shimmer" : "text-vayu-accent"
                }`}
              >
                {session.status === "reconnecting" ? "Reconnecting…" : MODE_LABEL[mode]}
              </motion.p>
            </AnimatePresence>
          </div>
        </section>

        {/* ── transcript ───────────────────────────────────────────── */}
        <section
          aria-label="Conversation"
          className="glass-panel glass-static flex min-h-[18rem] flex-col overflow-hidden rounded-2xl lg:h-full lg:min-h-0"
        >
          <div
            ref={scroller}
            className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5"
            role="log"
            aria-live="polite"
          >
            {session.messages.length === 0 ? (
              <EmptyState onPick={submit} disabled={!ready || session.busy} />
            ) : (
              <AnimatePresence initial={false}>
                {session.messages.map((m) => (
                  <Bubble key={m.id} message={m} reduced={!!reduced} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>

      {/* ── composer ────────────────────────────────────────────────── */}
      {/* mobile: pinned above the dock · desktop: last row of the viewport-height layout */}
      <div className="z-40 mt-6 max-lg:fixed max-lg:inset-x-2 max-lg:bottom-[5.25rem] max-lg:rounded-[1.25rem] max-lg:bg-vayu-bg/95 max-lg:p-1.5 max-lg:shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.5)] max-lg:backdrop-blur-xl">
        <div className="glass-panel glass-static edge-flow flex items-center gap-3 rounded-2xl p-2.5 pl-4">
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={ready ? "Message VAYU…" : "Waiting for connection…"}
              aria-label="Message VAYU"
              maxLength={4000}
              disabled={!ready}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-vayu-fg outline-none placeholder:text-vayu-muted disabled:opacity-60"
            />
            <Magnetic strength={0.25}>
              <motion.button
                type="submit"
                aria-label="Send message"
                disabled={!ready || session.busy || !draft.trim()}
                whileHover={reduced ? undefined : { scale: 1.08, rotate: -6 }}
                whileTap={reduced ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(120deg,var(--color-vayu-accent),var(--color-vayu-violet))] text-vayu-bg shadow-[0_0_24px_-6px_var(--color-vayu-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendHorizontal className="h-4 w-4" />
              </motion.button>
            </Magnetic>
          </form>
          <MicButton
            recording={recording}
            latched={latched}
            disabled={!canTalk && !recording}
            onPointerDown={onMicDown}
            onPointerUp={onMicUp}
          />
        </div>
        <p className="mt-2 text-center text-xs text-vayu-muted max-lg:mt-1" aria-live="polite">
          {micError ?? hint}
        </p>
      </div>
    </main>
  );
}

// ── pieces ─────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: LiveStatus }) {
  const map: Record<LiveStatus, { label: string; dot: string }> = {
    connecting: { label: "Connecting", dot: "bg-vayu-warning" },
    ready: { label: "Live", dot: "bg-vayu-success" },
    reconnecting: { label: "Reconnecting", dot: "bg-vayu-warning" },
    offline: { label: "Offline", dot: "bg-vayu-danger" },
  };
  const { label, dot } = map[status];
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-vayu-fg">
      <span className="relative flex h-2 w-2">
        {status !== "offline" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}

function CapChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      title={on ? `${label}: available` : `${label}: not configured on the server`}
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
        on
          ? "border-vayu-accent/40 text-vayu-accent"
          : "border-vayu-border text-vayu-muted line-through decoration-vayu-muted/60"
      }`}
    >
      <AudioLines className="h-3 w-3" />
      {label}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Magnetic strength={0.3}>
      <motion.button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        disabled={disabled}
        whileHover={reduced ? undefined : { y: -2, scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.92 }}
        transition={{ type: "spring", stiffness: 450, damping: 20 }}
        className={`glass grid h-9 w-9 place-items-center rounded-xl transition-[color,box-shadow] duration-300 hover:text-vayu-accent hover:shadow-[0_0_22px_-4px_var(--color-vayu-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
          active ? "text-vayu-accent" : "text-vayu-muted"
        }`}
      >
        {children}
      </motion.button>
    </Magnetic>
  );
}

function MicButton({
  recording,
  latched,
  disabled,
  onPointerDown,
  onPointerUp,
}: {
  recording: boolean;
  latched: boolean;
  disabled: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Magnetic strength={0.4}>
      <motion.button
        type="button"
        aria-label={recording ? "Stop and send" : "Talk to VAYU"}
        aria-pressed={recording}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        whileHover={reduced || disabled ? undefined : { scale: 1.1, y: -3 }}
        whileTap={reduced || disabled ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 420, damping: 17 }}
        className={`relative grid h-14 w-14 shrink-0 touch-none select-none place-items-center rounded-full text-white transition-shadow duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
          recording
            ? "bg-[linear-gradient(135deg,#f472b6,#ef4444)] shadow-[0_0_36px_-4px_#f472b6]"
            : "animate-gradient-x bg-[linear-gradient(120deg,var(--color-vayu-accent),var(--color-vayu-violet),var(--color-vayu-accent-2))] shadow-[0_0_28px_-6px_var(--color-vayu-accent)] hover:shadow-[0_0_40px_-4px_var(--color-vayu-violet)]"
        }`}
      >
        {recording && !reduced && (
          <>
            {[0, 0.5, 1].map((delay) => (
              <motion.span
                key={delay}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-vayu-pink"
                initial={{ scale: 1, opacity: 0.55 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, delay, ease: "easeOut" }}
              />
            ))}
          </>
        )}
        {recording && latched ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
      </motion.button>
    </Magnetic>
  );
}

function Bubble({ message, reduced }: { message: LiveMessage; reduced: boolean }) {
  const enter = reduced ? false : { opacity: 0, y: 12, scale: 0.97 };
  if (message.role === "notice") {
    return (
      <motion.p
        layout={!reduced}
        initial={enter}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="mx-auto w-fit rounded-full border border-vayu-warning/30 bg-vayu-warning/10 px-3 py-1 text-center text-xs text-vayu-warning"
      >
        {message.text}
      </motion.p>
    );
  }
  const mine = message.role === "user";
  return (
    <motion.div
      layout={!reduced}
      initial={enter}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine
            ? "rounded-br-md bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-vayu-accent)_85%,transparent),color-mix(in_oklab,var(--color-vayu-violet)_85%,transparent))] text-white shadow-[0_8px_30px_-12px_var(--color-vayu-accent)]"
            : message.flagged
              ? "rounded-bl-md border border-vayu-danger/40 bg-vayu-danger/10 text-vayu-danger"
              : "rounded-bl-md border border-vayu-border bg-vayu-bg/60 text-vayu-fg"
        }`}
      >
        {message.via === "voice" && (
          <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
            <AudioLines className="h-3 w-3" /> voice
          </span>
        )}
        {message.pending && !message.text ? (
          <TypingDots />
        ) : (
          <span className="whitespace-pre-wrap break-words">
            {message.text || (mine ? "Voice message" : "")}
            {message.pending && message.role === "assistant" && (
              <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-vayu-accent" />
            )}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1" aria-label="Transcribing">
      {[0, 0.15, 0.3].map((d) => (
        <motion.span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: d }}
        />
      ))}
    </span>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-6 text-center">
      <div>
        <p className="text-lg font-semibold">Talk to VAYU in real time</p>
        <p className="mt-1 text-sm text-vayu-muted">
          Speak or type — replies stream in as they&apos;re generated, and can be spoken back.
        </p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, type: "spring", stiffness: 300, damping: 24 }}
            whileHover={reduced || disabled ? undefined : { y: -3, scale: 1.02 }}
            whileTap={reduced || disabled ? undefined : { scale: 0.98 }}
            className="glass group rounded-xl px-3.5 py-3 text-left text-sm text-vayu-fg transition-[box-shadow,border-color] duration-300 hover:border-vayu-accent/50 hover:shadow-[0_0_26px_-8px_var(--color-vayu-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mr-1.5 text-vayu-accent transition-transform duration-300 group-hover:inline-block group-hover:translate-x-0.5">
              →
            </span>
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
