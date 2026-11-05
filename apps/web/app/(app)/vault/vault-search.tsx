"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Bookmark, Search, Waypoints, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Loading, Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { plural } from "@/lib/format";

type Result = { sourceId: string; title: string; score: number; hits: number; snippet: string };
type Related = { sourceId: string; title: string; score: number };
type RelatedState = { status: "loading" } | { status: "ready"; items: Related[] } | { status: "error" };

const MAX_SAVED = 10;

/** Saved searches are per workspace and per browser; anything malformed in storage is ignored. */
function readSaved(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0 && q.length <= 200).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function VaultSearch({ workspaceId }: { workspaceId: string }) {
  const ids = useId();
  const key = `vayu.savedSearches:${workspaceId}`;
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [related, setRelated] = useState<Record<string, RelatedState>>({});

  useEffect(() => {
    setSaved(readSaved(key));
  }, [key]);

  function persist(next: string[]) {
    setSaved(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage unavailable: saved searches last for this visit */
    }
  }

  async function search(q: string = query) {
    const text = q.trim();
    if (!text || loading) return;
    setQuery(text);
    setLoading(true);
    setError(null);
    setRelated({});
    try {
      const res = await fetch("/api/vault/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: text, topK: 12 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResults(((await res.json()) as { results?: Result[] }).results ?? []);
      setSearched(text);
    } catch {
      setError("Search isn't available right now. The AI service may be down; try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRelated(id: string) {
    setRelated((r) => ({ ...r, [id]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/vault/related?sourceId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(String(res.status));
      const items = ((await res.json()) as { related?: Related[] }).related ?? [];
      setRelated((r) => ({ ...r, [id]: { status: "ready", items } }));
    } catch {
      setRelated((r) => ({ ...r, [id]: { status: "error" } }));
    }
  }

  const isSaved = saved.includes(query.trim());

  return (
    <div className="flex flex-col gap-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="surface flex flex-col gap-3 rounded-2xl p-5"
      >
        <Field id={`${ids}-q`} label="Search your sources" hideLabel>
          {(p) => (
            <div className="flex gap-2">
              <Input
                {...p}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by meaning, e.g. ways to reduce churn"
                className="min-w-0 flex-1"
              />
              <Button type="submit" variant="primary" icon={<Search aria-hidden className="h-4 w-4" />} loading={loading} disabled={!query.trim()}>
                Search
              </Button>
            </div>
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {saved.map((q) => (
            <span key={q} className="inline-flex items-center rounded-full border border-vayu-border bg-vayu-inset">
              <button type="button" onClick={() => void search(q)} className="rounded-l-full py-1 pl-3 pr-1.5 text-xs font-medium text-vayu-fg hover:text-vayu-accent">
                {q}
              </button>
              <button
                type="button"
                aria-label={`Remove saved search "${q}"`}
                onClick={() => persist(saved.filter((s) => s !== q))}
                className="grid h-6 w-6 place-items-center rounded-r-full text-vayu-muted hover:text-vayu-danger"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            </span>
          ))}
          {query.trim() && !isSaved && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Bookmark aria-hidden className="h-3.5 w-3.5" />}
              onClick={() => persist([query.trim(), ...saved.filter((s) => s !== query.trim())].slice(0, MAX_SAVED))}
            >
              Save this search
            </Button>
          )}
        </div>
      </form>

      {error && <Notice tone="danger">{error}</Notice>}
      {loading && <Loading label="Searching…" />}

      {!loading && results !== null && searched !== null && (
        <section aria-label="Results" className="flex flex-col gap-3">
          <p role="status" className="text-sm text-vayu-muted">
            {results.length === 0 ? `No matches for "${searched}".` : `${plural(results.length, "source")} match "${searched}".`}
          </p>
          {results.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="Nothing matched"
              description="The vault searches the sources you've added in Research. Try other words, or add a source that covers this."
              action={
                <Link href="/research" className="text-sm font-medium text-vayu-accent underline underline-offset-2">
                  Add sources in Research
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((r) => {
                const rel = related[r.sourceId];
                return (
                  <li key={r.sourceId} className="surface rounded-2xl p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 className="min-w-0 break-words text-sm font-semibold text-vayu-fg">{r.title}</h3>
                      <p className="text-xs tabular-nums text-vayu-subtle" title="How closely this source matches your search, from 0 to 1">
                        {plural(r.hits, "matching passage")} · similarity {r.score.toFixed(2)}
                      </p>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-vayu-fg/85">{r.snippet}</p>
                    <div className="mt-3">
                      {!rel ? (
                        <Button size="sm" variant="ghost" icon={<Waypoints aria-hidden className="h-3.5 w-3.5" />} onClick={() => void loadRelated(r.sourceId)}>
                          Show related sources
                        </Button>
                      ) : rel.status === "loading" ? (
                        <Loading label="Finding related sources…" className="text-xs" />
                      ) : rel.status === "error" ? (
                        <p className="text-xs font-medium text-vayu-danger">Related sources couldn&rsquo;t be loaded.</p>
                      ) : rel.items.length === 0 ? (
                        <p className="text-xs text-vayu-muted">No other source is closely related.</p>
                      ) : (
                        <div>
                          <p className="text-xs font-medium text-vayu-muted">Related sources</p>
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {rel.items.map((x) => (
                              <li key={x.sourceId} className="rounded-full border border-vayu-border bg-vayu-inset px-2.5 py-0.5 text-xs text-vayu-fg">
                                {x.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {results === null && !loading && !error && (
        <EmptyState
          icon={<Search />}
          title="Search everything you've added"
          description="Results come from the files and pages in Research. Save searches you run often; they're kept in this browser for this workspace."
        />
      )}
    </div>
  );
}
