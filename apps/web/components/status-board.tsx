"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Disclosure } from "@/components/ui/disclosure";
import { Loading, Notice, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { Check, CheckStatus } from "@/lib/diagnostics";
import { plural } from "@/lib/format";

type Result = { site: string; checks: Check[]; checkedAt: string };

const LOOK: Record<CheckStatus, { tone: Tone; label: string; Icon: typeof CircleCheck; text: string }> = {
  ok: { tone: "success", label: "Working", Icon: CircleCheck, text: "text-vayu-success" },
  warn: { tone: "warning", label: "Limited", Icon: TriangleAlert, text: "text-vayu-warning" },
  fail: { tone: "danger", label: "Problem", Icon: CircleAlert, text: "text-vayu-danger" },
  skip: { tone: "neutral", label: "Not checked", Icon: CircleDashed, text: "text-vayu-subtle" },
};

/** Runs /api/diagnostics: every hop an AI feature depends on, in order, with the fix for each. */
export function StatusBoard({ canFix }: { canFix: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostics", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as Result);
    } catch (err) {
      setError(
        err instanceof Error && /^\d+$/.test(err.message)
          ? `The checks couldn't run (error ${err.message}).`
          : "The checks couldn't run. Check your connection and try again.",
      );
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const count = (s: CheckStatus) => result?.checks.filter((c) => c.status === s).length ?? 0;
  const failures = count("fail");
  const limited = count("warn");
  const skipped = count("skip");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={cn("text-sm font-semibold", !result ? "text-vayu-muted" : failures ? "text-vayu-danger" : limited ? "text-vayu-warning" : "text-vayu-success")}>
          {!result
            ? running
              ? "Checking…"
              : ""
            : failures
              ? `${plural(failures, "problem")} to fix${skipped ? ` · ${skipped} not checked until then` : ""}`
              : limited
                ? `Working, with ${plural(limited, "limitation")}`
                : "Everything is working."}
        </p>
        <Button variant="secondary" icon={<RefreshCw aria-hidden className="h-4 w-4" />} loading={running} loadingLabel="Checking…" onClick={() => void run()}>
          Run again
        </Button>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      {running && !result && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Loading label="Checking… if the AI service was asleep this can take up to a minute." />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {result && (
        <>
          <ul className="flex flex-col gap-3">
            {result.checks.map((c) => {
              const look = LOOK[c.status];
              return (
                <li key={c.id} className={cn("surface rounded-2xl p-4", c.status === "fail" && "border-vayu-danger/40")}>
                  <div className="flex items-start gap-3">
                    <look.Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", look.text)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-vayu-fg">{c.label}</h2>
                        <Badge tone={look.tone}>{look.label}</Badge>
                      </div>
                      <p className="mt-1 break-words text-sm text-vayu-muted">{c.detail}</p>
                      {c.fix &&
                        (canFix ? (
                          <div className="mt-2 flex items-start gap-2 rounded-xl border border-vayu-border bg-vayu-inset/70 px-3 py-2">
                            <p className="min-w-0 flex-1 break-words text-sm text-vayu-fg">
                              <span className="font-semibold">Fix: </span>
                              {c.fix}
                            </p>
                            <CopyButton value={c.fix} label="Copy fix" />
                          </div>
                        ) : (
                          <Disclosure summary="How to fix it" className="mt-2">
                            <p className="break-words">{c.fix}</p>
                            <p className="mt-2 text-xs text-vayu-muted">This needs whoever deploys VAYU; share it with a workspace admin.</p>
                          </Disclosure>
                        ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-vayu-subtle">
            {result.site} · checked <time dateTime={result.checkedAt}>{new Date(result.checkedAt).toLocaleTimeString()}</time>
          </p>
        </>
      )}
    </div>
  );
}
