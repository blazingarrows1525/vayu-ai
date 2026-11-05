"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, FilePlus2 } from "lucide-react";
import type { Editor, JSONContent } from "@vayu/editor";
import { CopilotPanel } from "@/components/copilot-panel";
import { EditorSkeleton, LazyEditor } from "@/components/editor/lazy-editor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { timeAgo } from "@/lib/format";

type Stored = { content: JSONContent; at: number };

/**
 * A private drafting space with Copilot. Drafts are kept in this browser (per user) until they're
 * saved as a document; nothing here is stored on the server.
 */
export function Scratchpad({ userId, canWrite }: { userId: string; canWrite: boolean }) {
  const router = useRouter();
  const key = `vayu-scratchpad:${userId}`;
  const [initial, setInitial] = useState<Stored | null | undefined>(undefined); // undefined: not read yet
  const [editor, setEditor] = useState<Editor | null>(null);
  const [empty, setEmpty] = useState(true);
  const [keptAt, setKeptAt] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const stored = raw ? (JSON.parse(raw) as Stored) : null;
      setInitial(stored?.content ? stored : null);
      setKeptAt(stored?.at ?? null);
    } catch {
      setInitial(null);
    }
  }, [key]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onUpdate(json: JSONContent) {
    // From the update itself (the editor may hold on to the first render's callback).
    const blocks = json.content ?? [];
    setEmpty(blocks.length === 0 || (blocks.length === 1 && blocks[0]!.type === "paragraph" && !blocks[0]!.content?.length));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ content: json, at: Date.now() } satisfies Stored));
        setKeptAt(Date.now());
      } catch {
        /* storage unavailable: the draft lives until the tab closes */
      }
    }, 400);
  }

  async function saveAsDocument() {
    if (!editor || editor.isEmpty || creating) return;
    setCreating(true);
    setError(null);
    const text = editor.getText();
    const title = (text.split("\n").find((line) => line.trim()) ?? "Untitled").trim().slice(0, 120);
    try {
      const created = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!created.ok) {
        setError(
          created.status === 403
            ? "Your role in this workspace can't create documents."
            : `The document wasn't created (error ${created.status}). Your draft is still here.`,
        );
        setCreating(false);
        return;
      }
      const { id } = (await created.json()) as { id: string };
      const saved = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content: editor.getJSON(), contentText: text }),
      });
      if (!saved.ok) {
        setError(`A document was created but its text wasn't saved (error ${saved.status}). Your draft is still here.`);
        setCreating(false);
        return;
      }
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      router.push(`/docs/${id}`);
    } catch {
      setError("Couldn't reach VAYU. Your draft is still here; try again.");
      setCreating(false);
    }
  }

  function clear() {
    editor?.commands.clearContent();
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setKeptAt(null);
    setEmpty(true);
    setConfirmClear(false);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-nav pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="Workspace"
        title="Scratchpad"
        description="Draft freely with Copilot. Drafts stay in this browser until you save them as a document; nothing here is shared."
        actions={
          <>
            <Button variant="ghost" icon={<Eraser aria-hidden className="h-4 w-4" />} disabled={empty} onClick={() => setConfirmClear(true)}>
              Clear
            </Button>
            {canWrite && (
              <Button
                variant="primary"
                icon={<FilePlus2 aria-hidden className="h-4 w-4" />}
                loading={creating}
                loadingLabel="Saving…"
                disabled={empty}
                onClick={() => void saveAsDocument()}
              >
                Save as document
              </Button>
            )}
          </>
        }
        className="mb-6"
      />

      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <div className="doc-surface surface rounded-2xl px-5 py-7 sm:px-10 sm:py-9">
            <div className="mx-auto max-w-3xl">
              {initial === undefined ? (
                <EditorSkeleton />
              ) : (
                <LazyEditor
                  content={initial?.content}
                  autofocus
                  placeholder="Start a draft, or type / for headings, lists, tables and more…"
                  onCreate={(ed) => {
                    setEditor(ed);
                    setEmpty(ed.isEmpty);
                  }}
                  onUpdate={onUpdate}
                />
              )}
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-vayu-subtle">
            {keptAt ? `Kept in this browser · updated ${timeAgo(keptAt)}` : "Kept in this browser as you type."}
          </p>
        </div>

        <aside aria-label="Copilot" className="min-w-0 lg:sticky lg:top-[4.5rem] lg:self-start">
          <div className="surface rounded-2xl p-4">
            <h2 className="mb-3 text-section font-semibold">Copilot</h2>
            {canWrite ? (
              <CopilotPanel editor={editor} />
            ) : (
              <Notice tone="info" role="note">
                Copilot is available to editors and above in this workspace.
              </Notice>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear the scratchpad?"
        description="The draft is removed from this browser. This can't be undone."
        confirmLabel="Clear draft"
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
