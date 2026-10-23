"use client";

import { useCallback, useEffect, useState } from "react";
import type { Check, CheckStatus } from "@/lib/diagnostics";

interface Result {
  site: string;
  checks: Check[];
  checkedAt: string;
}

const STYLE: Record<CheckStatus, { icon: string; ring: string; text: string }> = {
  ok: { icon: "✓", ring: "border-emerald-500/40 bg-emerald-500/10", text: "text-emerald-500" },
  warn: { icon: "!", ring: "border-amber-500/40 bg-amber-500/10", text: "text-amber-500" },
  fail: { icon: "✕", ring: "border-red-500/40 bg-red-500/10", text: "text-red-500" },
};

/** Runs /api/diagnostics and lists every hop an AI feature needs, with the fix for each. */
export function StatusBoard() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult((await res.json()) as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const failures = result?.checks.filter((c) => c.status === "fail").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-vayu-accent">VAYU AI</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">System status</h1>
          <p className="mt-2 text-sm text-vayu-muted">
            Checks every piece the AI features depend on and says exactly what to change.
          </p>
        </div>
        <button
          onClick={() => void run()}
          disabled={running}
          className="rounded-xl bg-vayu-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {running ? "Checking…" : "Run again"}
        </button>
      </header>

      {running && !result && (
        <p className="mt-10 animate-pulse text-sm text-vayu-muted">
          Checking… if the AI service was asleep this can take up to a minute.
        </p>
      )}
      {error && <p className="mt-10 text-sm text-red-500">Couldn’t run the checks: {error}</p>}

      {result && (
        <>
          <p className={`mt-8 text-sm font-semibold ${failures ? "text-red-500" : "text-emerald-500"}`} role="status">
            {failures ? `${failures} problem${failures > 1 ? "s" : ""} to fix` : "Everything is working."}
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {result.checks.map((c) => {
              const s = STYLE[c.status];
              return (
                <li key={c.id} className={`rounded-2xl border p-4 ${s.ring}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 w-4 text-center font-bold ${s.text}`} aria-hidden>
                      {s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-vayu-fg">
                        {c.label}
                        <span className="sr-only"> — {c.status}</span>
                      </p>
                      <p className="mt-1 break-words text-sm text-vayu-muted">{c.detail}</p>
                      {c.fix && (
                        <p className="mt-2 break-words text-sm text-vayu-fg">
                          <span className="font-semibold">Fix: </span>
                          {c.fix}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-xs text-vayu-muted">
            {result.site} · checked {new Date(result.checkedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </main>
  );
}
