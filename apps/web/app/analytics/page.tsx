"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Analytics {
  documents: number;
  words: number;
  readingMinutes: number;
  recentlyEdited: number;
  aiGenerations: number;
  aiTokens: number;
  aiCostUsd: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d as Analytics));
  }, []);

  const cards: { label: string; value: string }[] = data
    ? [
        { label: "Documents", value: String(data.documents) },
        { label: "Words written", value: data.words.toLocaleString() },
        { label: "Reading time", value: `${data.readingMinutes} min` },
        { label: "Edited this week", value: String(data.recentlyEdited) },
        { label: "AI generations", value: String(data.aiGenerations) },
        { label: "AI tokens", value: data.aiTokens.toLocaleString() },
        { label: "AI spend", value: `$${data.aiCostUsd.toFixed(4)}` },
      ]
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Analytics</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-vayu-muted hover:text-vayu-fg">
          Dashboard
        </Link>
      </header>

      {!data ? (
        <p className="text-sm text-vayu-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-vayu-border bg-vayu-border sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-vayu-surface p-5">
              <p className="text-xs uppercase tracking-wider text-vayu-muted">{c.label}</p>
              <p className="mt-2 text-2xl font-bold text-vayu-fg">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
