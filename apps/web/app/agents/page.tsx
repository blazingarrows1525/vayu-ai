"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AgentMeta {
  type: string;
  label: string;
  description: string;
}

interface Step {
  node: string;
  output: string;
  tokens: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [type, setType] = useState("research");
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/ai/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => {
        const list = (d.agents ?? []) as AgentMeta[];
        setAgents(list);
        if (list[0]) setType(list[0].type);
      });
  }, []);

  async function run() {
    if (!task.trim()) return;
    setRunning(true);
    setSteps([]);
    try {
      const res = await fetch("/api/agents/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentType: type, task }),
      });
      if (!res.ok || !res.body) {
        setSteps([{ node: "error", output: `HTTP ${res.status}`, tokens: 0 }]);
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
          const ev = frame.split("\n").find((l) => l.startsWith("event:"))?.slice(6).trim();
          const data = frame.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (ev === "step" && data) setSteps((p) => [...p, JSON.parse(data) as Step]);
        }
      }
    } finally {
      setRunning(false);
    }
  }

  const current = agents.find((a) => a.type === type);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Agent Command Center</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-vayu-muted hover:text-vayu-fg">
          Dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-vayu-border bg-vayu-bg px-2 py-2 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
          >
            {agents.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-vayu-muted">{current?.description}</span>
        </div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the task for the agent…"
          rows={3}
          className="mt-3 w-full rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
        />
        <button
          onClick={run}
          disabled={running}
          className="mt-3 rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
        >
          {running ? "Running…" : "Run agent"}
        </button>
      </section>

      {steps.length > 0 && (
        <section className="mt-6 flex flex-col gap-3">
          {steps.map((s, i) => (
            <div
              key={`${s.node}-${i}`}
              className="rounded-2xl border border-vayu-border bg-vayu-surface p-4"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-vayu-accent/15 px-2 py-0.5 text-xs font-semibold text-vayu-accent">
                  {s.node}
                </span>
                <span className="text-xs text-vayu-muted">{s.tokens} tok</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-vayu-fg">
                {s.output}
              </p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
