"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CheckCheck, MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState, Loading, Notice, Skeleton } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { timeAgo } from "@/lib/format";

type Comment = { id: string; body: string; resolved: boolean; authorName: string | null; createdAt: string };

const MAX = 5000;

/** Discussion on a document: open comments first (newest on top), resolved ones tucked away. */
export function CommentsPanel({
  documentId,
  canWrite,
  onOpenCount,
}: {
  documentId: string;
  canWrite: boolean;
  onOpenCount: (count: number) => void;
}) {
  const ids = useId();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`);
      if (!res.ok) throw new Error(String(res.status));
      setComments(((await res.json()) as { comments?: Comment[] }).comments ?? []);
    } catch {
      setLoadError("Comments couldn't be loaded.");
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (comments) onOpenCount(comments.filter((c) => !c.resolved).length);
  }, [comments, onOpenCount]);

  async function post() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setActionError(
          res.status === 403
            ? "Your role can read comments but not add them."
            : (data?.error ?? `The comment wasn't posted (error ${res.status}).`),
        );
        return;
      }
      setDraft("");
      await load();
    } catch {
      setActionError("Couldn't reach VAYU. Your comment is still in the box; try again.");
    } finally {
      setPosting(false);
    }
  }

  async function toggle(c: Comment) {
    setToggling(c.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId: c.id, resolved: !c.resolved }),
      });
      if (!res.ok) {
        setActionError(`That comment couldn't be ${c.resolved ? "reopened" : "resolved"} (error ${res.status}).`);
        return;
      }
      setComments((all) => all?.map((x) => (x.id === c.id ? { ...x, resolved: !c.resolved } : x)) ?? all);
    } catch {
      setActionError("Couldn't reach VAYU. Try again.");
    } finally {
      setToggling(null);
    }
  }

  const open = comments?.filter((c) => !c.resolved) ?? [];
  const resolved = comments?.filter((c) => c.resolved) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
          className="flex flex-col gap-2"
        >
          <Field
            id={`${ids}-comment`}
            label="Add a comment"
            hideLabel
            error={draft.length > MAX ? `Comments are limited to ${MAX.toLocaleString("en")} characters.` : undefined}
          >
            {(p) => (
              <Textarea
                {...p}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void post();
                  }
                }}
                placeholder="Add a comment… (Ctrl/⌘+Enter to post)"
                className="min-h-20"
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="primary" loading={posting} loadingLabel="Posting…" disabled={!draft.trim() || draft.length > MAX}>
              Comment
            </Button>
          </div>
        </form>
      )}

      {actionError && <Notice tone="danger">{actionError}</Notice>}

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
      ) : comments === null ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Loading srOnly label="Loading comments…" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title="No comments yet"
          headingLevel={3}
          description={canWrite ? "Comments are visible to everyone in this workspace." : "Nobody has commented on this document."}
          className="py-8"
        />
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="flex flex-col gap-2" aria-label="Open comments">
              {open.map((c) => (
                <CommentItem key={c.id} comment={c} canWrite={canWrite} pending={toggling === c.id} onToggle={toggle} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-vayu-muted">Every comment is resolved.</p>
          )}
          {resolved.length > 0 && (
            <Disclosure summary={`Resolved (${resolved.length})`}>
              <ul className="flex flex-col gap-2" aria-label="Resolved comments">
                {resolved.map((c) => (
                  <CommentItem key={c.id} comment={c} canWrite={canWrite} pending={toggling === c.id} onToggle={toggle} />
                ))}
              </ul>
            </Disclosure>
          )}
        </>
      )}
    </div>
  );
}

function CommentItem({
  comment: c,
  canWrite,
  pending,
  onToggle,
}: {
  comment: Comment;
  canWrite: boolean;
  pending: boolean;
  onToggle: (c: Comment) => void;
}) {
  return (
    <li className="rounded-xl border border-vayu-border bg-vayu-inset/60 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-vayu-fg">{c.authorName || "Someone"}</p>
        <time dateTime={c.createdAt} className="shrink-0 text-xs text-vayu-subtle">
          {timeAgo(c.createdAt)}
        </time>
      </div>
      <p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed ${c.resolved ? "text-vayu-muted" : "text-vayu-fg/90"}`}>
        {c.body}
      </p>
      {canWrite && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            icon={c.resolved ? <RotateCcw aria-hidden className="h-3.5 w-3.5" /> : <CheckCheck aria-hidden className="h-3.5 w-3.5" />}
            onClick={() => onToggle(c)}
          >
            {c.resolved ? "Reopen" : "Resolve"}
          </Button>
        </div>
      )}
    </li>
  );
}
