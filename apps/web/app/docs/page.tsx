"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
}

export default function DocsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((d) => setDocs((d.documents ?? []) as Doc[]));
  }, []);

  async function create() {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    if (res.ok) router.push(`/docs/${(await res.json()).id}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Documents</h1>
        </div>
        <button
          onClick={create}
          className="rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2"
        >
          New document
        </button>
      </header>

      <ul className="flex flex-col gap-2">
        {docs.length === 0 && (
          <li className="text-sm text-vayu-muted">No documents yet — create one.</li>
        )}
        {docs.map((d) => (
          <li key={d.id}>
            <Link
              href={`/docs/${d.id}`}
              className="flex items-center justify-between rounded-lg border border-vayu-border bg-vayu-surface px-4 py-3 text-sm transition hover:border-vayu-accent"
            >
              <span className="font-medium text-vayu-fg">{d.title}</span>
              <span className="text-xs text-vayu-muted">
                {new Date(d.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
