"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck, Save } from "lucide-react";
import type { Editor, JSONContent } from "@vayu/editor";
import { CopilotPanel } from "@/components/copilot-panel";
import { LazyEditor } from "@/components/editor/lazy-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Spinner } from "@/components/ui/spinner";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/format";
import { CommentsPanel } from "./comments-panel";
import { HistoryPanel } from "./history-panel";

type Doc = { id: string; title: string; content: object | null; updatedAt: string };
type SaveState =
  | { kind: "saved"; at: number }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; message: string };
type Draft = { title: string; content: JSONContent; at: number };
type Tab = "copilot" | "comments" | "history";

const AUTOSAVE_AFTER_MS = 1200;

function saveFailure(status: number): string {
  if (status === 401) return "Your session has ended. Sign in again; your changes are kept on this device.";
  if (status === 403) return "Your role in this workspace no longer allows editing.";
  if (status === 404) return "This document no longer exists in this workspace.";
  if (status === 413) return "This document is too large to save.";
  return `The server didn't save your changes (error ${status}).`;
}

/**
 * Editing one document: autosave a moment after you stop typing (and on Ctrl/⌘+S), a status that
 * reflects what the server actually stored, and a local backup that survives failed saves,
 * reloads and navigation. Copilot, comments and history sit alongside.
 */
export function DocumentWorkspace({ doc, canWrite }: { doc: Doc; canWrite: boolean }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [title, setTitle] = useState(doc.title || "Untitled");
  const titleRef = useRef(title);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: Date.parse(doc.updatedAt) });
  const [announcement, setAnnouncement] = useState("");
  const [tab, setTab] = useState<Tab>(canWrite ? "copilot" : "comments");
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [versionCount, setVersionCount] = useState<number | null>(null);
  const [recovered, setRecovered] = useState<(Draft & { serverNewer: boolean }) | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const dirty = useRef(false);
  const revision = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const lastSaveOk = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = `vayu-draft:${doc.id}`;

  const writeDraft = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      const draft: Draft = { title: titleRef.current, content: ed.getJSON(), at: Date.now() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* storage full or unavailable: the server save is still attempted */
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  /** Saves pending changes; resolves true once everything typed so far is on the server. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    while (inFlight.current) await inFlight.current; // one save at a time, in order
    const ed = editorRef.current;
    if (!canWrite || !ed) return true;
    if (!dirty.current) return lastSaveOk.current;

    const covers = revision.current;
    dirty.current = false;
    writeDraft();
    setSave({ kind: "saving" });
    const attempt = (async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: titleRef.current, content: ed.getJSON(), contentText: ed.getText() }),
        });
        if (!res.ok) {
          dirty.current = true;
          setSave({ kind: "error", message: saveFailure(res.status) });
          return (lastSaveOk.current = false);
        }
        if (revision.current === covers) {
          setSave({ kind: "saved", at: Date.now() });
          clearDraft();
        } else {
          setSave({ kind: "dirty" }); // typed during the save; the pending autosave covers it
        }
        return (lastSaveOk.current = true);
      } catch {
        dirty.current = true;
        setSave({
          kind: "error",
          message: "You're offline or VAYU is unreachable. Your changes are kept on this device and save once you're back.",
        });
        return (lastSaveOk.current = false);
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = attempt;
    return attempt;
  }, [canWrite, clearDraft, doc.id, writeDraft]);

  const markChanged = useCallback(() => {
    if (!canWrite) return;
    revision.current += 1;
    dirty.current = true;
    setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_AFTER_MS);
  }, [canWrite, flush]);

  // Offer to bring back a local backup the server doesn't have.
  useEffect(() => {
    if (!editor || !canWrite) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      const same =
        JSON.stringify(draft.content) === JSON.stringify(editor.getJSON()) && draft.title === titleRef.current;
      if (!draft.content || same) clearDraft();
      else setRecovered({ ...draft, serverNewer: Date.parse(doc.updatedAt) > draft.at });
    } catch {
      clearDraft();
    }
  }, [editor, canWrite, draftKey, clearDraft, doc.updatedAt]);

  // Ctrl/⌘+S saves now; leaving with unsaved changes keeps a backup and asks first.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canWrite) void flush().then((ok) => ok && setAnnouncement("Saved"));
      }
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty.current && !inFlight.current) return;
      writeDraft();
      e.preventDefault();
    }
    function onOnline() {
      if (dirty.current) void flush();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [canWrite, flush, writeDraft]);

  // Navigating away inside the app: keep a backup and send the last save with keepalive (it
  // outlives the page for bodies up to 64 KB; the backup covers larger documents).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      const ed = editorRef.current;
      if (!canWrite || !ed || !dirty.current) return;
      try {
        writeDraft();
        const body = JSON.stringify({ title: titleRef.current, content: ed.getJSON(), contentText: ed.getText() });
        void fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body,
          keepalive: body.length < 60_000,
        })
          .then((res) => res.ok && clearDraft())
          .catch(() => undefined);
      } catch {
        /* the editor may already be torn down; the backup was written on the last change */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on unmount
    [],
  );

  // Keep "Saved 3 minutes ago" current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function onTitleChange(value: string) {
    setTitle(value);
    titleRef.current = value;
    markChanged();
  }

  function restoreDraft() {
    if (!recovered || !editor) return;
    editor.commands.setContent(recovered.content, { emitUpdate: false });
    setTitle(recovered.title);
    titleRef.current = recovered.title;
    setRecovered(null);
    markChanged();
  }

  function applyRestoredVersion(content: JSONContent) {
    editor?.commands.setContent(content, { emitUpdate: false });
    revision.current += 1;
    dirty.current = false;
    lastSaveOk.current = true;
    clearDraft();
    setSave({ kind: "saved", at: Date.now() });
  }

  const tabs = [
    ...(canWrite ? [{ id: "copilot" as const, label: "Copilot" }] : []),
    {
      id: "comments" as const,
      label: "Comments",
      badge: openComments ? <CountBadge count={openComments} label="open" /> : undefined,
    },
    {
      id: "history" as const,
      label: "History",
      badge: versionCount ? <CountBadge count={versionCount} label="snapshots" /> : undefined,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-nav pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-vayu-muted transition-colors hover:text-vayu-fg"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Documents
        </Link>
        <div className="flex items-center gap-2">
          {canWrite ? (
            <>
              <SaveIndicator state={save} now={now} />
              <Button
                size="sm"
                variant="secondary"
                icon={<Save aria-hidden className="h-3.5 w-3.5" />}
                onClick={() => void flush().then((ok) => ok && setAnnouncement("Saved"))}
                disabled={save.kind === "saving"}
                aria-keyshortcuts="Control+S Meta+S"
                title="Save now (Ctrl/⌘+S). Changes also save automatically."
              >
                Save
              </Button>
            </>
          ) : (
            <Badge>View only</Badge>
          )}
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {save.kind === "error" && (
        <Notice
          tone="danger"
          className="mt-4"
          title="Your latest changes aren't saved yet"
          action={
            <Button size="sm" variant="secondary" onClick={() => void flush()}>
              Retry
            </Button>
          }
        >
          {save.message}
        </Notice>
      )}

      {recovered && (
        <Notice
          tone="warning"
          className="mt-4"
          title="Unsaved changes found on this device"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={restoreDraft}>
                Restore them
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearDraft();
                  setRecovered(null);
                }}
              >
                Discard
              </Button>
            </div>
          }
        >
          Edits from {timeAgo(recovered.at, now)} didn&rsquo;t reach the server.
          {recovered.serverNewer && " The document has been saved since then, so restoring replaces those newer changes."}
        </Notice>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="doc-surface surface min-w-0 rounded-2xl px-5 py-7 sm:px-10 sm:py-9">
          <div className="mx-auto max-w-3xl">
            {/* The page heading for screen-reader navigation; the visible title is the editable field. */}
            <h1 className="sr-only">{title.trim() || "Untitled"}</h1>
            <label htmlFor="doc-title" className="sr-only">
              Document title
            </label>
            <input
              id="doc-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.commands.focus("start");
                }
              }}
              readOnly={!canWrite}
              placeholder="Untitled"
              maxLength={300}
              className="w-full border-b border-transparent bg-transparent pb-2 text-3xl font-semibold tracking-tight text-vayu-fg outline-none transition-colors placeholder:text-vayu-subtle focus-visible:border-vayu-accent/50 read-only:cursor-default"
            />
            <div className="mt-4">
              <LazyEditor
                content={(doc.content as JSONContent | null) ?? undefined}
                editable={canWrite}
                placeholder={canWrite ? "Start writing, or type / for headings, lists, tables and more…" : undefined}
                onCreate={(ed) => {
                  editorRef.current = ed;
                  setEditor(ed);
                }}
                onUpdate={markChanged}
              />
            </div>
          </div>
        </div>

        <aside
          aria-label="Document tools"
          className="min-w-0 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-4.5rem-var(--nav-clearance))] lg:self-start lg:overflow-y-auto"
        >
          <div className="surface rounded-2xl p-4">
            <Tabs idBase="doc-tools" label="Document tools" items={tabs} value={tab} onChange={setTab} />
            <div className="mt-4">
              {canWrite && (
                <TabPanel idBase="doc-tools" id="copilot" value={tab}>
                  <CopilotPanel editor={editor} documentId={doc.id} />
                </TabPanel>
              )}
              <TabPanel idBase="doc-tools" id="comments" value={tab}>
                <CommentsPanel documentId={doc.id} canWrite={canWrite} onOpenCount={setOpenComments} />
              </TabPanel>
              <TabPanel idBase="doc-tools" id="history" value={tab}>
                <HistoryPanel
                  documentId={doc.id}
                  canWrite={canWrite}
                  flush={flush}
                  onRestored={applyRestoredVersion}
                  onCount={setVersionCount}
                />
              </TabPanel>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className="rounded-full bg-vayu-fg/[0.08] px-1.5 text-[11px] font-semibold tabular-nums leading-5 text-vayu-muted">
      {count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function SaveIndicator({ state, now }: { state: SaveState; now: number }) {
  if (state.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-vayu-muted">
        <Spinner className="h-3.5 w-3.5" />
        Saving…
      </span>
    );
  }
  if (state.kind === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-vayu-muted">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-vayu-warning" />
        Unsaved changes
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-vayu-danger">
        <CircleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" />
        Not saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-vayu-muted">
      <CircleCheck aria-hidden className="h-3.5 w-3.5 text-vayu-success" />
      Saved {timeAgo(state.at, now)}
    </span>
  );
}
