"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bot, FilePlus2, Play, RefreshCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState, Loading, Notice, Skeleton } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { saveMarkdownAsDocument } from "@/lib/save-as-document";
import { readEventStream } from "@/lib/sse";

type AgentMeta = { type: string; label: string; description: string };
type Step = { node: string; output: string; tokens: number };
type Result = { status: "completed" | "limited" | "unavailable"; output: string };
type RunState = "idle" | "running" | "done" | "stopped" | "error";

const MAX_TASK = 4000;
const STEP_LABEL: Record<string, string> = {
  agent: "Reasoning",
  tools: "Using tools",
  give_up: "Reached the step limit",
  error: "Error",
};

export function AgentsConsole({ canRun }: { canRun: boolean }) {
  const ids = useId();
  const [agents, setAgents] = useState<AgentMeta[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState<RunState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string } | { error: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const lastTask = useRef("");

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const res = await fetch("/api/ai/agents");
      if (!res.ok) throw new Error(String(res.status));
      const list = ((await res.json()) as { agents?: AgentMeta[] }).agents ?? [];
      setAgents(list);
      setType((t) => t || list[0]?.type || "");
    } catch {
      setCatalogError("The AI service didn't return its agents, so runs aren't possible right now.");
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    return () => controller.current?.abort();
  }, [loadCatalog]);

  async function start() {
    const text = task.trim();
    if (!text || !type || run === "running") return;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    lastTask.current = text;
    setSteps([]);
    setResult(null);
    setError(null);
    setSaved(null);
    setRun("running");
    let gotResult = false;
    try {
      const res = await fetch("/api/agents/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentType: type, task: text }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          res.status === 403
            ? "Agents are available to editors and above in this workspace."
            : (data?.error ?? `The run didn't start (error ${res.status}).`),
        );
        setRun("error");
        return;
      }
      await readEventStream(res.body, (event, data) => {
        if (event === "step") setSteps((all) => [...all, data as Step]);
        else if (event === "result") {
          gotResult = true;
          setResult(data as Result);
        }
      });
      if (controller.current === ac) {
        if (gotResult) setRun("done");
        else {
          setError("The run ended without an answer. Check the steps above, or try again.");
          setRun("error");
        }
      }
    } catch {
      if (ac.signal.aborted) {
        if (controller.current === ac) setRun("stopped");
        return;
      }
      setError("The connection to the agent was lost. Steps so far are kept; try again.");
      setRun("error");
    }
  }

  function stop() {
    controller.current?.abort();
  }

  async function save() {
    if (!result?.output) return;
    setSaving(true);
    const agent = agents?.find((a) => a.type === type);
    const r = await saveMarkdownAsDocument(`${agent?.label ?? "Agent"}: ${lastTask.current.slice(0, 80)}`, result.output);
    setSaved(r.ok ? { id: r.id } : { error: r.error });
    setSaving(false);
  }

  const running = run === "running";
  const status =
    run === "running"
      ? steps.length === 0
        ? "Starting the run…"
        : `Running · ${plural(steps.length, "step")} so far`
      : run === "done"
        ? `Finished after ${plural(steps.length, "step")}`
        : run === "stopped"
          ? `Stopped after ${plural(steps.length, "step")}. Steps so far are kept.`
          : "";

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
        className="surface flex flex-col gap-4 rounded-2xl p-5"
      >
        {!canRun && (
          <Notice tone="info" role="note">
            Agents are available to editors and above in this workspace.
          </Notice>
        )}
        <fieldset disabled={!canRun || running}>
          <legend className="text-sm font-medium text-vayu-fg">Agent</legend>
          {catalogError ? (
            <Notice
              tone="danger"
              className="mt-2"
              action={
                <Button size="sm" variant="secondary" icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />} onClick={() => void loadCatalog()}>
                  Retry
                </Button>
              }
            >
              {catalogError}
            </Notice>
          ) : agents === null ? (
            <div aria-busy="true" className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Loading srOnly label="Loading agents…" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => (
                <label
                  key={a.type}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-vayu-accent",
                    type === a.type
                      ? "border-vayu-accent/50 bg-vayu-accent/[0.08]"
                      : "border-vayu-border hover:border-vayu-border-strong/60",
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-agent`}
                    value={a.type}
                    checked={type === a.type}
                    onChange={() => setType(a.type)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-vayu-accent)] focus-visible:outline-none"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-vayu-fg">{a.label}</span>
                    <span className="block text-xs leading-relaxed text-vayu-muted">{a.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <Field
          id={`${ids}-task`}
          label="Task"
          description="Say what you want and any constraints. The agent decides which steps to take."
          error={task.length > MAX_TASK ? `Tasks are limited to ${MAX_TASK.toLocaleString("en")} characters.` : undefined}
        >
          {(p) => (
            <Textarea
              {...p}
              value={task}
              disabled={!canRun || running}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void start();
                }
              }}
              placeholder="e.g. Compare three approaches to caching LLM responses and recommend one"
              className="min-h-28"
            />
          )}
        </Field>
        {running ? (
          <Button variant="secondary" block className="sm:w-auto sm:self-end" icon={<Square aria-hidden className="h-3.5 w-3.5" />} onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            block
            className="sm:w-auto sm:self-end"
            icon={<Play aria-hidden className="h-4 w-4" />}
            disabled={!canRun || !type || !task.trim() || task.length > MAX_TASK}
          >
            Run agent
          </Button>
        )}
      </form>

      <section aria-label="Run" className="flex min-w-0 flex-col gap-4">
        <p role="status" className="text-sm text-vayu-muted empty:hidden">
          {status}
        </p>
        {error && <Notice tone="danger">{error}</Notice>}

        {run === "idle" && steps.length === 0 ? (
          <EmptyState
            icon={<Bot />}
            title="No run yet"
            description="Pick an agent and describe a task. Its steps appear here as it works, then the full answer."
          />
        ) : (
          <>
            {steps.length > 0 && (
              <ol aria-label="Steps" className="flex flex-col gap-2">
                {steps.map((s, i) => (
                  <li key={i} className={cn("surface rounded-xl px-4 py-3", s.node === "error" && "border-vayu-danger/40")}>
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn("text-sm font-medium", s.node === "error" ? "text-vayu-danger" : "text-vayu-fg")}>
                        <span className="mr-2 tabular-nums text-vayu-subtle">{i + 1}.</span>
                        {STEP_LABEL[s.node] ?? s.node}
                      </p>
                      {s.tokens > 0 && <span className="shrink-0 text-xs tabular-nums text-vayu-subtle">{plural(s.tokens, "token")}</span>}
                    </div>
                    {s.output && (
                      <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-vayu-fg/85">
                        {s.output}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {running && <Loading label={steps.length === 0 ? "Planning the run…" : "Working on the next step…"} />}

            {result?.status === "unavailable" && (
              <Notice tone="danger" title="No language model is available">
                The AI service has no working model key, so the agent couldn&rsquo;t think.{" "}
                <Link href="/status" className="font-medium underline underline-offset-2">
                  Service status
                </Link>{" "}
                shows how to fix it.
              </Notice>
            )}
            {result && result.status !== "unavailable" && result.output && (
              <section aria-labelledby={`${ids}-result`} className="surface rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id={`${ids}-result`} className="text-section font-semibold">
                    Result
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={result.output} withText />
                    {canRun && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<FilePlus2 aria-hidden className="h-3.5 w-3.5" />}
                        loading={saving}
                        loadingLabel="Saving…"
                        onClick={() => void save()}
                      >
                        Save as document
                      </Button>
                    )}
                  </div>
                </div>
                {result.status === "limited" && (
                  <Notice tone="warning" className="mt-3">
                    The agent reached its step limit before finishing. This is its best answer so far.
                  </Notice>
                )}
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-vayu-fg">{result.output}</p>
                {saved &&
                  ("id" in saved ? (
                    <p role="status" className="mt-3 text-sm text-vayu-success">
                      Saved.{" "}
                      <Link href={`/docs/${saved.id}`} className="font-medium underline underline-offset-2">
                        Open the document
                      </Link>
                    </p>
                  ) : (
                    <Notice tone="danger" className="mt-3">
                      {saved.error}
                    </Notice>
                  ))}
              </section>
            )}
          </>
        )}
      </section>
    </div>
  );
}
