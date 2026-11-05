"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CopilotUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  provider: string;
  cached?: boolean;
  /** false when no key is configured for the provider, so the text is a placeholder. */
  configured?: boolean;
}

export interface CopilotPayload {
  command: string;
  selection?: string;
  context?: string;
  tone?: string;
  documentId?: string;
  model?: string;
  provider?: string;
}

export type CopilotStatus = "idle" | "streaming" | "done" | "stopped" | "error";

function failureMessage(status: number, body: { error?: unknown } | null): string {
  if (status === 401) return "Your session has ended. Sign in again to use Copilot.";
  if (status === 403) return "Copilot is available to editors and above in this workspace.";
  if (typeof body?.error === "string" && body.error.length < 300) return body.error;
  return `Copilot didn't respond (error ${status}). Service status shows whether the AI service is up.`;
}

/**
 * Streams a Copilot run from the BFF. The generated text and any error are kept apart, so an
 * error can never be inserted into a document. `stop()` aborts the request (and, through the
 * BFF, the upstream generation); unmounting does the same.
 */
export function useCopilot() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<CopilotStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<CopilotUsage | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const reset = useCallback(() => {
    // Detach first, so the aborted run doesn't report itself as "stopped" after this.
    const running = controller.current;
    controller.current = null;
    running?.abort();
    setText("");
    setUsage(null);
    setError(null);
    setStatus("idle");
  }, []);

  const stop = useCallback(() => {
    controller.current?.abort();
  }, []);

  const run = useCallback(async (payload: CopilotPayload) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setText("");
    setUsage(null);
    setError(null);
    setStatus("streaming");
    let failed = false;
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        setError(failureMessage(res.status, body));
        failed = true;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const lines = frame.split("\n");
          const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const data = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!data) continue;
          try {
            if (ev === "token") {
              const parsed = JSON.parse(data) as { delta?: string };
              setText((t) => t + (parsed.delta ?? ""));
            } else if (ev === "usage") {
              setUsage(JSON.parse(data) as CopilotUsage);
            } else if (ev === "error") {
              const parsed = JSON.parse(data) as { message?: string };
              setError(parsed.message ? `Copilot stopped: ${parsed.message}` : "Copilot stopped with an error.");
              failed = true;
            }
          } catch {
            /* ignore a malformed frame rather than abandoning the stream */
          }
        }
      }
    } catch {
      if (ac.signal.aborted) {
        if (controller.current === ac) setStatus("stopped");
        return;
      }
      setError("Couldn't reach VAYU. Check your connection and try again.");
      failed = true;
    } finally {
      if (controller.current === ac && !ac.signal.aborted) {
        setStatus(failed ? "error" : "done");
        controller.current = null;
      }
    }
  }, []);

  return { text, status, streaming: status === "streaming", error, usage, run, stop, reset };
}
