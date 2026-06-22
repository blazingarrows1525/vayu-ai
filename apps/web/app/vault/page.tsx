"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Result {
  sourceId: string;
  title: string;
  score: number;
  hits: number;
  snippet: string;
}

interface Related {
  sourceId: string;
  title: string;
  score: number;
}

const SAVED_KEY = "vayu.savedSearches";

export default function VaultPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [related, setRelated] = useState<Record<string, Related[]>>({});

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"));
    } catch {
      setSaved([]);
    }
  }, []);

  function persist(next: string[]) {
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  async function search(q: string = query) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setResults([]);
    setRelated({});
    try {
      const res = await fetch("/api/vault/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, topK: 12 }),
      });
      setResults(((await res.json()).results ?? []) as Result[]);
    } finally {
      setLoading(false);
    }
  }

  function save() {
    const q = query.trim();
    if (q && !saved.includes(q)) persist([q, ...saved].slice(0, 10));
  }

  async function loadRelated(id: string) {
    const res = await fetch(`/api/vault/related?sourceId=${encodeURIComponent(id)}`);
    const data = await res.json();
    setRelated((p) => ({ ...p, [id]: (data.related ?? []) as Related[] }));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Knowledge Vault</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-vayu-muted hover:text-vayu-fg">
          Dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Semantic search across everything you've saved…"
            className="flex-1 rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
          />
          <button
            onClick={() => search()}
            disabled={loading}
            className="rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            onClick={save}
            className="rounded-lg border border-vayu-border px-3 py-2 text-sm text-vayu-muted transition hover:border-vayu-accent hover:text-vayu-fg"
          >
            Save
          </button>
        </div>
        {saved.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {saved.map((s) => (
              <button
                key={s}
                onClick={() => search(s)}
                className="rounded-full border border-vayu-border bg-vayu-bg px-3 py-1 text-xs text-vayu-muted transition hover:border-vayu-accent hover:text-vayu-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 flex flex-col gap-3">
        {results.map((r) => {
          const rel = related[r.sourceId];
          return (
          <div
            key={r.sourceId}
            className="rounded-2xl border border-vayu-border bg-vayu-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-vayu-fg">{r.title}</span>
              <span className="shrink-0 text-xs text-vayu-muted">
                {r.hits} hit{r.hits === 1 ? "" : "s"} · {r.score.toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-vayu-muted">{r.snippet}…</p>
            <button
              onClick={() => loadRelated(r.sourceId)}
              className="mt-2 text-xs text-vayu-accent hover:underline"
            >
              Find related
            </button>
            {rel && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-vayu-border pt-2">
                {rel.length === 0 && (
                  <li className="text-xs text-vayu-muted">No related sources.</li>
                )}
                {rel.map((item) => (
                  <li key={item.sourceId} className="text-xs text-vayu-muted">
                    ↳ {item.title} · {item.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          );
        })}
      </section>
    </main>
  );
}
