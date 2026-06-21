"use client";

import { useState } from "react";

/** Calls the BFF → AI bridge and shows the response. Proves JWT verification. */
export function AiPing() {
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ping() {
    setLoading(true);
    setOutput(null);
    try {
      const res = await fetch("/api/ai/agents");
      const json = await res.json();
      setOutput(`HTTP ${res.status} · ${JSON.stringify(json)}`);
    } catch (err) {
      setOutput(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={ping}
        disabled={loading}
        className="rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
      >
        {loading ? "Calling…" : "Ping intelligence plane"}
      </button>
      {output && (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-vayu-border bg-vayu-bg p-3 text-xs text-vayu-muted">
          {output}
        </pre>
      )}
    </div>
  );
}
