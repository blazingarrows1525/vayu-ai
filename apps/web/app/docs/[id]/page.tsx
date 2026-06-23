"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type Editor, type JSONContent, VayuEditor } from "@vayu/editor";

interface Comment {
  id: string;
  body: string;
  resolved: boolean;
  authorName: string;
  createdAt: string;
}

export default function DocPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [editor, setEditor] = useState<Editor | null>(null);
  const [content, setContent] = useState<JSONContent | undefined>(undefined);
  const [title, setTitle] = useState("Untitled");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [versions, setVersions] = useState<
    { version: number; summary: string | null; createdAt: string }[]
  >([]);
  const [diffData, setDiffData] = useState<{ changes: any[]; from: number; to: number } | null>(null);

  function loadComments() {
    fetch(`/api/documents/${id}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => setComments((d.comments ?? []) as Comment[]));
  }

  useEffect(() => {
    if (!id) return;
    fetch(`/api/documents/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setTitle(d.title ?? "Untitled");
          setContent(d.content as JSONContent);
        }
        setLoaded(true);
      });
    loadComments();
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!editor) return;
    setSaving(true);
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          content: editor.getJSON(),
          contentText: editor.getText(),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!draft.trim()) return;
    await fetch(`/api/documents/${id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    setDraft("");
    loadComments();
  }

  async function toggle(c: Comment) {
    await fetch(`/api/documents/${id}/comments`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commentId: c.id, resolved: !c.resolved }),
    });
    loadComments();
  }

  function loadVersions() {
    fetch(`/api/documents/${id}/versions`)
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((d) => setVersions(d.versions ?? []));
  }

  async function viewDiff(from: number, to: number) {
    if (diffData?.from === from && diffData?.to === to) {
      setDiffData(null);
      return;
    }
    const r = await fetch(`/api/documents/${id}/diff?from=${from}&to=${to}`);
    if (r.ok) {
      setDiffData(await r.json());
    }
  }

  async function snapshot() {
    await fetch(`/api/documents/${id}/versions`, { method: "POST" });
    loadVersions();
  }

  async function restore(version: number) {
    const res = await fetch(`/api/documents/${id}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version }),
    });
    if (res.ok && editor) editor.commands.setContent((await res.json()).content);
  }

  if (!loaded) return <main className="px-6 py-12 text-vayu-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-4 flex items-center justify-between gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-2xl font-bold tracking-tight text-vayu-fg outline-none"
        />
        <div className="flex items-center gap-2">
          <Link href="/docs" className="text-sm text-vayu-muted hover:text-vayu-fg">
            All docs
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
          <VayuEditor content={content} onCreate={setEditor} />
        </div>

        <aside className="rounded-2xl border border-vayu-border bg-vayu-surface p-4">
          <h2 className="text-sm font-semibold">Comments</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Add a comment…"
              className="flex-1 rounded-lg border border-vayu-border bg-vayu-bg px-2 py-1.5 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
            />
            <button
              onClick={addComment}
              className="rounded-lg border border-vayu-border px-2 py-1.5 text-xs text-vayu-muted hover:border-vayu-accent hover:text-vayu-fg"
            >
              Add
            </button>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-vayu-border bg-vayu-bg p-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-vayu-fg">{c.authorName}</span>
                  <button
                    onClick={() => toggle(c)}
                    className={c.resolved ? "text-vayu-accent" : "text-vayu-muted"}
                  >
                    {c.resolved ? "resolved" : "resolve"}
                  </button>
                </div>
                <p className={`mt-1 ${c.resolved ? "text-vayu-muted line-through" : "text-vayu-fg"}`}>
                  {c.body}
                </p>
              </li>
            ))}
          </ul>

          <h2 className="mt-5 text-sm font-semibold">History</h2>
          <button
            onClick={snapshot}
            className="mt-2 rounded-lg border border-vayu-border px-2 py-1 text-xs text-vayu-muted transition hover:border-vayu-accent hover:text-vayu-fg"
          >
            Snapshot now
          </button>
          <ul className="mt-2 flex flex-col gap-1">
            {versions.map((v, i) => {
              const previousVersion = versions[i + 1]?.version;
              return (
              <li
                key={v.version}
                className="flex flex-col text-xs text-vayu-muted"
              >
                <div className="flex items-center justify-between">
                  <span>
                    v{v.version} · {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    {previousVersion !== undefined && (
                      <button
                        onClick={() => viewDiff(previousVersion, v.version)}
                        className="text-vayu-accent hover:underline"
                        title={`Compare with v${previousVersion}`}
                      >
                        diff
                      </button>
                    )}
                    <button
                      onClick={() => restore(v.version)}
                      className="text-vayu-accent hover:underline"
                    >
                      restore
                    </button>
                  </div>
                </div>
                {diffData && diffData.from === previousVersion && diffData.to === v.version && (
                  <div className="mt-2 rounded bg-vayu-surface p-2 font-mono text-[10px] leading-relaxed max-h-40 overflow-y-auto w-full">
                    {diffData.changes.map((part, index) => (
                      <span
                        key={index}
                        className={
                          part.added
                            ? "bg-emerald-900/30 text-emerald-400"
                            : part.removed
                            ? "bg-rose-900/30 text-rose-400 line-through"
                            : ""
                        }
                      >
                        {part.value}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            )})}
          </ul>
        </aside>
      </div>
    </main>
  );
}
