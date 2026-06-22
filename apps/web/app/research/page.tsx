"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Source {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  sourceType: string;
}

interface Citation {
  sourceId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

interface AskResult {
  answer: string;
  confidence: number;
  citations: Citation[];
  retrieval: { model: string; candidates: number; used: number };
}

export default function ResearchPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/research/sources");
    if (res.ok) setSources(((await res.json()).sources ?? []) as Source[]);
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      await fetch("/api/research/upload", { method: "POST", body: form });
      await loadSources();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onAsk() {
    if (!query.trim()) return;
    setAsking(true);
    setResult(null);
    try {
      const res = await fetch("/api/research/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, topK: 8 }),
      });
      setResult((await res.json()) as AskResult);
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Research Center</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-vayu-muted hover:text-vayu-fg">
          Dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Knowledge sources</h2>
          <label className="cursor-pointer rounded-lg bg-vayu-accent px-3 py-1.5 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2">
            {uploading ? "Uploading…" : "Upload (PDF, DOCX, TXT, MD)"}
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {sources.length === 0 && (
            <li className="text-sm text-vayu-muted">No sources yet — upload a document.</li>
          )}
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm"
            >
              <span className="truncate">{s.title}</span>
              <span className="ml-3 shrink-0 text-xs text-vayu-muted">
                {s.sourceType} · {s.chunkCount} chunks · {s.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-vayu-border bg-vayu-surface p-6">
        <h2 className="text-sm font-semibold">Ask your sources</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAsk()}
            placeholder="What do these documents say about…?"
            className="flex-1 rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
          />
          <button
            onClick={onAsk}
            disabled={asking}
            className="rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
          >
            {asking ? "Thinking…" : "Ask"}
          </button>
        </div>

        {result && (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-vayu-muted">Confidence</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-vayu-border">
                <div
                  className="h-full bg-vayu-accent"
                  style={{ width: `${Math.round((result.confidence ?? 0) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-vayu-muted">
                {Math.round((result.confidence ?? 0) * 100)}%
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-vayu-fg">
              {result.answer}
            </p>
            {result.citations?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-vayu-muted">
                  Sources ({result.retrieval?.used ?? result.citations.length})
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {result.citations.map((c, i) => (
                    <li
                      key={`${c.sourceId}-${c.chunkIndex}`}
                      className="rounded-lg border border-vayu-border bg-vayu-bg p-3 text-xs text-vayu-muted"
                    >
                      <span className="text-vayu-accent">[{i + 1}]</span> score{" "}
                      {c.score.toFixed(2)} · {c.snippet}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
