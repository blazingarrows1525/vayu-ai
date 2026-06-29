"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Source {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  sourceType: string;
  stored?: boolean;
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

const MAX_UPLOAD_MB = 25;

export default function ResearchPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setNotice(`"${file.name}" is too large — the limit is ${MAX_UPLOAD_MB}MB.`);
      e.target.value = "";
      return;
    }
    setNotice(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const res = await fetch("/api/research/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          detail?: string;
          error?: string;
        };
        setNotice(data.detail ?? data.error ?? "Upload failed. Please try again.");
      }
      await loadSources();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onAddUrl() {
    if (!url.trim()) return;
    setAddingUrl(true);
    try {
      await fetch("/api/research/ingest-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setUrl("");
      await loadSources();
    } finally {
      setAddingUrl(false);
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
            {uploading ? "Uploading…" : "Upload (PDF, DOCX, PPTX, XLSX, CSV, TXT, MD)"}
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,.csv,.xlsx"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddUrl()}
            placeholder="…or paste a web URL to ingest"
            className="flex-1 rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
          />
          <button
            onClick={onAddUrl}
            disabled={addingUrl}
            className="rounded-lg border border-vayu-border px-3 py-2 text-sm text-vayu-muted transition hover:border-vayu-accent hover:text-vayu-fg disabled:opacity-60"
          >
            {addingUrl ? "Adding…" : "Add URL"}
          </button>
        </div>
        {notice && (
          <p className="mt-3 rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-xs text-vayu-muted">
            {notice}
          </p>
        )}
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
              <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-vayu-muted">
                {s.stored && (
                  <span
                    title="Original file saved to object storage"
                    className="rounded bg-vayu-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-vayu-accent"
                  >
                    saved
                  </span>
                )}
                <span>
                  {s.sourceType} · {s.chunkCount} chunks · {s.status}
                </span>
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
