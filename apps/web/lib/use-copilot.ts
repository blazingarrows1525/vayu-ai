"use client";

import { useCallback, useState } from "react";

export interface CopilotUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  provider: string;
  cached?: boolean;
  configured?: boolean;
}

export interface CopilotPayload {
  command: string;
  selection?: string;
  context?: string;
  tone?: string;
  documentId?: string;
}

/** Consumes the BFF copilot SSE stream and exposes incremental text + usage. */
export function useCopilot() {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<CopilotUsage | null>(null);

  const reset = useCallback(() => {
    setText("");
    setUsage(null);
  }, []);

  const run = useCallback(async (payload: CopilotPayload) => {
    setText("");
    setUsage(null);
    setStreaming(true);
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        setText(`Error: HTTP ${res.status}`);
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
          if (ev === "token") {
            const parsed = JSON.parse(data) as { delta?: string };
            setText((t) => t + (parsed.delta ?? ""));
          } else if (ev === "usage") {
            setUsage(JSON.parse(data) as CopilotUsage);
          } else if (ev === "error") {
            const parsed = JSON.parse(data) as { message?: string };
            setText((t) => `${t}\n[error: ${parsed.message ?? "unknown"}]`);
          }
        }
      }
    } finally {
      setStreaming(false);
    }
  }, []);

  return { text, streaming, usage, run, reset };
}
