"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * VAYU Live socket: fetches a short-lived token from the BFF, opens the AI plane's
 * WebSocket directly, authenticates with the first frame, and reconnects with
 * backoff. Protocol is documented in apps/ai/app/api/v1/ws.py.
 */

export type LiveStatus = "connecting" | "ready" | "reconnecting" | "offline";

export type LiveMessage = {
  id: string;
  role: "user" | "assistant" | "notice";
  text: string;
  via?: "voice" | "text";
  /** user voice: transcript not back yet · assistant: still streaming */
  pending?: boolean;
  flagged?: boolean;
};

export type LiveCaps = { stt: boolean; tts: boolean };

type ServerFrame =
  | { type: "ready"; stt: boolean; tts: boolean }
  | { type: "transcript"; content: string }
  | { type: "token"; content: string }
  | { type: "audio"; data: string; mime?: string }
  | { type: "error"; message: string; retract?: boolean }
  | { type: "done" }
  | { type: "pong" };

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function useLiveSession(handlers: {
  onAudio: (base64Wav: string) => void;
  onToken?: () => void;
}) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [caps, setCaps] = useState<LiveCaps>({ stt: false, tts: false });
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0); // bump → fresh socket (and fresh server history)

  const wsRef = useRef<WebSocket | null>(null);
  const busyRef = useRef(false);
  const assistantId = useRef<string | null>(null);
  const pendingUserId = useRef<string | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const setBusyBoth = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const patch = (id: string, change: Partial<LiveMessage>) =>
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)));

    const endTurn = () => {
      if (assistantId.current) patch(assistantId.current, { pending: false });
      if (pendingUserId.current) patch(pendingUserId.current, { pending: false });
      assistantId.current = null;
      pendingUserId.current = null;
      setStreaming(false);
      setBusyBoth(false);
    };

    const onFrame = (frame: ServerFrame) => {
      switch (frame.type) {
        case "ready":
          attempt = 0;
          setCaps({ stt: frame.stt, tts: frame.tts });
          setStatus("ready");
          clearInterval(heartbeat);
          heartbeat = setInterval(() => {
            wsRef.current?.send(JSON.stringify({ type: "ping" }));
          }, HEARTBEAT_MS);
          break;
        case "transcript":
          if (pendingUserId.current) {
            patch(pendingUserId.current, { text: frame.content, pending: false });
            pendingUserId.current = null;
          }
          break;
        case "token": {
          const id = assistantId.current;
          if (id) {
            setMessages((list) =>
              list.map((m) => (m.id === id ? { ...m, text: m.text + frame.content } : m)),
            );
          } else {
            const fresh = nextId();
            assistantId.current = fresh;
            setMessages((list) => [
              ...list,
              { id: fresh, role: "assistant", text: frame.content, pending: true },
            ]);
            setStreaming(true);
          }
          handlersRef.current.onToken?.();
          break;
        }
        case "audio":
          handlersRef.current.onAudio(frame.data);
          break;
        case "error":
          if (frame.retract && assistantId.current) {
            patch(assistantId.current, { text: frame.message, flagged: true, pending: false });
          } else {
            setMessages((list) => [...list, { id: nextId(), role: "notice", text: frame.message }]);
          }
          break;
        case "done":
          endTurn();
          break;
      }
    };

    const scheduleRetry = () => {
      if (disposed) return;
      setStatus("reconnecting");
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    async function connect() {
      if (disposed) return;
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      let session: { url: string; token: string };
      try {
        const res = await fetch("/api/realtime/session", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          setFatal("Your session has ended — sign in again to use VAYU Live.");
          setStatus("offline");
          return;
        }
        if (!res.ok) throw new Error(`session ${res.status}`);
        session = (await res.json()) as { url: string; token: string };
      } catch {
        scheduleRetry();
        return;
      }
      if (disposed) return;

      const ws = new WebSocket(session.url);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: session.token }));
      ws.onmessage = (event) => {
        try {
          onFrame(JSON.parse(String(event.data)) as ServerFrame);
        } catch {
          /* ignore a malformed frame rather than drop the session */
        }
      };
      ws.onclose = () => {
        clearInterval(heartbeat);
        if (wsRef.current !== ws) return; // superseded by a reset
        wsRef.current = null;
        if (busyRef.current) {
          setMessages((list) => [
            ...list,
            { id: nextId(), role: "notice", text: "Connection dropped mid-reply — reconnecting…" },
          ]);
          endTurn();
        }
        scheduleRetry();
      };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close(1000, "page closed");
    };
  }, [generation]);

  const send = useCallback((frame: object, message: LiveMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || busyRef.current) return false;
    if (message.pending) pendingUserId.current = message.id;
    setMessages((list) => [...list, message]);
    ws.send(JSON.stringify(frame));
    setBusyBoth(true);
    return true;
  }, []);

  const sendText = useCallback(
    (text: string, speak: boolean) =>
      send(
        { type: "text", content: text, speak },
        { id: nextId(), role: "user", text, via: "text" },
      ),
    [send],
  );

  const sendAudio = useCallback(
    (base64: string, mime: string, speak: boolean) =>
      send(
        { type: "audio", data: base64, mime, speak },
        { id: nextId(), role: "user", text: "", via: "voice", pending: true },
      ),
    [send],
  );

  const notice = useCallback((text: string) => {
    setMessages((list) => [...list, { id: nextId(), role: "notice", text }]);
  }, []);

  /** New conversation: clear the transcript and open a fresh socket (fresh server memory). */
  const reset = useCallback(() => {
    setMessages([]);
    assistantId.current = null;
    pendingUserId.current = null;
    setStreaming(false);
    setBusyBoth(false);
    setGeneration((g) => g + 1);
  }, []);

  return { status, caps, messages, busy, streaming, fatal, sendText, sendAudio, notice, reset };
}
