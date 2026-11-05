"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, GitCompareArrows, History, RotateCcw } from "lucide-react";
import type { JSONContent } from "@vayu/editor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Loading, Notice, Skeleton } from "@/components/ui/feedback";
import { timeAgo } from "@/lib/format";

type Version = { version: number; summary: string | null; createdAt: string };
type Change = { value: string; added?: boolean; removed?: boolean };
type Comparison = { from: number; to: number; changes: Change[] | null; error?: string };
type Message = { tone: "success" | "danger"; text: string };

/**
 * Snapshots of a document: save one, compare a snapshot with the one before it, or restore it.
 * Saving and restoring both wait for pending edits to reach the server first.
 */
export function HistoryPanel({
  documentId,
  canWrite,
  flush,
  onRestored,
  onCount,
}: {
  documentId: string;
  canWrite: boolean;
  flush: () => Promise<boolean>;
  onRestored: (content: JSONContent) => void;
  onCount: (count: number) => void;
}) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (!res.ok) throw new Error(String(res.status));
      setVersions(((await res.json()) as { versions?: Version[] }).versions ?? []);
    } catch {
      setLoadError("Version history couldn't be loaded.");
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (versions) onCount(versions.length);
  }, [versions, onCount]);

  async function snapshot() {
    setSnapshotting(true);
    setMessage(null);
    try {
      if (!(await flush())) {
        setMessage({ tone: "danger", text: "Your latest changes aren't saved yet, so a snapshot would miss them. Try again once saving works." });
        return;
      }
      const res = await fetch(`/api/documents/${documentId}/versions`, { method: "POST" });
      if (!res.ok) {
        setMessage({ tone: "danger", text: `The snapshot wasn't saved (error ${res.status}).` });
        return;
      }
      const { version } = (await res.json()) as { version?: number };
      setMessage({ tone: "success", text: version ? `Saved snapshot v${version}.` : "Snapshot saved." });
      await load();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach VAYU. Try again." });
    } finally {
      setSnapshotting(false);
    }
  }

  async function compare(from: number, to: number) {
    if (comparison?.from === from && comparison.to === to) return setComparison(null);
    setComparison({ from, to, changes: null });
    try {
      const res = await fetch(`/api/documents/${documentId}/diff?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(String(res.status));
      const { changes } = (await res.json()) as { changes: Change[] };
      setComparison((c) => (c?.from === from && c.to === to ? { from, to, changes } : c));
    } catch {
      setComparison((c) => (c?.from === from && c.to === to ? { from, to, changes: null, error: "These versions couldn't be compared." } : c));
    }
  }

  async function restore(version: number) {
    setRestoring(true);
    setMessage(null);
    try {
      if (!(await flush())) {
        setMessage({ tone: "danger", text: "Your latest changes aren't saved yet, so restoring was cancelled to keep them. Try again once saving works." });
        return;
      }
      const res = await fetch(`/api/documents/${documentId}/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        setMessage({ tone: "danger", text: `Version ${version} wasn't restored (error ${res.status}).` });
        return;
      }
      const { content, backupVersion } = (await res.json()) as { content: JSONContent; backupVersion: number | null };
      onRestored(content);
      setMessage({
        tone: "success",
        text: backupVersion
          ? `Restored v${version}. The text you had is kept as v${backupVersion}.`
          : `Restored v${version}.`,
      });
      setComparison(null);
      await load();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach VAYU. Nothing was changed." });
    } finally {
      setRestoring(false);
      setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            icon={<Camera aria-hidden className="h-4 w-4" />}
            loading={snapshotting}
            loadingLabel="Saving snapshot…"
            onClick={() => void snapshot()}
          >
            Save a snapshot
          </Button>
          <p className="text-xs leading-relaxed text-vayu-muted">
            A snapshot keeps a copy of the saved text that you can compare with or restore later.
          </p>
        </div>
      )}

      {message && (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      )}

      {loadError ? (
        <Notice
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Notice>
      ) : versions === null ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Loading srOnly label="Loading history…" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : versions.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No snapshots yet"
          headingLevel={3}
          description={canWrite ? "Save one before a big edit, so you can go back." : "Editors can save snapshots of this document."}
          className="py-8"
        />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Snapshots, newest first">
          {versions.map((v, i) => {
            const previous = versions[i + 1]?.version;
            const open = comparison !== null && comparison.from === previous && comparison.to === v.version;
            return (
              <li key={v.version} className="rounded-xl border border-vayu-border bg-vayu-inset/60 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-vayu-fg">Version {v.version}</p>
                  <time dateTime={v.createdAt} className="shrink-0 text-xs text-vayu-subtle">
                    {timeAgo(v.createdAt)}
                  </time>
                </div>
                {v.summary && v.summary !== `Snapshot v${v.version}` && (
                  <p className="mt-0.5 text-xs text-vayu-muted">{v.summary}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {previous !== undefined && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={open}
                      icon={<GitCompareArrows aria-hidden className="h-3.5 w-3.5" />}
                      onClick={() => void compare(previous, v.version)}
                    >
                      {open ? "Hide changes" : `Changes since v${previous}`}
                    </Button>
                  )}
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw aria-hidden className="h-3.5 w-3.5" />}
                      onClick={() => setConfirm(v.version)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
                {open && <DiffView comparison={comparison} />}
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={confirm !== null}
        tone="primary"
        title={`Restore version ${confirm ?? ""}?`}
        description="The document's text is replaced with this snapshot. The text you have now is saved as a new snapshot first, so you can switch back."
        confirmLabel="Restore"
        pendingLabel="Restoring…"
        pending={restoring}
        onConfirm={() => confirm !== null && void restore(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function DiffView({ comparison }: { comparison: Comparison }) {
  if (comparison.error) return <p className="mt-2 text-xs font-medium text-vayu-danger">{comparison.error}</p>;
  if (!comparison.changes) return <Loading label="Comparing…" className="mt-2 text-xs" />;
  const changed = comparison.changes.some((c) => c.added || c.removed);
  return (
    <div className="mt-2">
      {!changed ? (
        <p className="text-xs text-vayu-muted">No text changes between these versions.</p>
      ) : (
        <>
          <p className="mb-1.5 flex gap-3 text-[11px] text-vayu-muted" aria-hidden>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-vayu-success/30" /> Added
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-vayu-danger/25" /> Removed
            </span>
          </p>
          <div
            tabIndex={0}
            aria-label={`Changes from version ${comparison.from} to ${comparison.to}`}
            className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-vayu-border bg-vayu-surface px-3 py-2.5 text-sm leading-relaxed text-vayu-fg/80"
          >
            {comparison.changes.map((part, index) =>
              part.added ? (
                <ins key={index} className="rounded-sm bg-vayu-success/20 text-vayu-fg no-underline">
                  <span className="sr-only">[added: </span>
                  {part.value}
                  <span className="sr-only">]</span>
                </ins>
              ) : part.removed ? (
                <del key={index} className="rounded-sm bg-vayu-danger/15 text-vayu-muted decoration-vayu-danger/70">
                  <span className="sr-only">[removed: </span>
                  {part.value}
                  <span className="sr-only">]</span>
                </del>
              ) : (
                <span key={index}>{part.value}</span>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
