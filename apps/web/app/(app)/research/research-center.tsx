"use client";

import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { FilePlus2, Globe, Library, RefreshCw, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState, Loading, Notice, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { RESEARCH_ACCEPT, RESEARCH_FILE_TYPES } from "@/lib/product";
import { saveMarkdownAsDocument } from "@/lib/save-as-document";

type Source = { id: string; title: string; status: string; chunkCount: number; sourceType: string; stored?: boolean };
type Citation = { sourceId: string; chunkIndex: number; score: number; snippet: string };
type Answer = { answer: string; confidence: number; citations: Citation[]; retrieval?: { model: string; candidates: number; used: number } };
type Message = { tone: "success" | "danger" | "warning"; text: string };

const MAX_UPLOAD_MB = 25;
const NO_MODEL_PREFIX = "Retrieved relevant context (see citations).";

function errorText(data: unknown, fallback: string): string {
  const d = data as { detail?: unknown; error?: unknown } | null;
  if (typeof d?.detail === "string") return d.detail;
  if (typeof d?.error === "string" && d.error !== "forbidden") return d.error;
  return fallback;
}

function SourceStatus({ status }: { status: string }) {
  if (status === "ready") return <Badge tone="success">Ready</Badge>;
  if (status === "processing") return <Badge tone="neutral">Processing</Badge>;
  if (status === "pending_embeddings") return <Badge tone="warning">Keyword search only</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

export function ResearchCenter({ canWrite }: { canWrite: boolean }) {
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [asked, setAsked] = useState("");
  const [saved, setSaved] = useState<{ id: string } | { error: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSources = useCallback(async () => {
    setSourcesError(null);
    try {
      const res = await fetch("/api/research/sources");
      if (!res.ok) throw new Error(String(res.status));
      setSources(((await res.json()) as { sources?: Source[] }).sources ?? []);
    } catch {
      setSourcesError("Your sources couldn't be loaded. The AI service may be unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function upload(file: File) {
    setMessage(null);
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setMessage({ tone: "danger", text: `"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_MB} MB.` });
      return;
    }
    setUploading(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const res = await fetch("/api/research/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({
          tone: "danger",
          text:
            res.status === 403
              ? "Your role can ask questions but not add sources."
              : errorText(data, `"${file.name}" couldn't be added (error ${res.status}).`),
        });
        return;
      }
      setMessage({ tone: "success", text: `Added "${file.name}".` });
      await loadSources();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach VAYU. Check your connection and try again." });
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function addUrl() {
    const value = url.trim();
    setUrlError(null);
    setMessage(null);
    try {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      setUrlError("Enter a full web address starting with http:// or https://");
      return;
    }
    setAddingUrl(true);
    try {
      const res = await fetch("/api/research/ingest-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Keep what they typed, so fixing a typo doesn't mean pasting again.
        setUrlError(res.status === 403 ? "Your role can't add sources." : errorText(data, "That page couldn't be added. Check the address, or try another page."));
        return;
      }
      setUrl("");
      setMessage({ tone: "success", text: "Added the page." });
      await loadSources();
    } catch {
      setUrlError("Couldn't reach VAYU. Check your connection and try again.");
    } finally {
      setAddingUrl(false);
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    setSaved(null);
    setAsked(q);
    try {
      const res = await fetch("/api/research/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, topK: 8 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof (data as Answer | null)?.answer !== "string") {
        setAskError(errorText(data, "The question couldn't be answered right now. Your question is kept; try again."));
        return;
      }
      setAnswer(data as Answer);
    } catch {
      setAskError("Couldn't reach VAYU. Your question is kept; try again.");
    } finally {
      setAsking(false);
    }
  }

  async function saveAnswer() {
    if (!answer) return;
    setSaving(true);
    const cited = answer.citations
      .map((c, i) => `${i + 1}. ${titleOf(c.sourceId)}: "${c.snippet.trim().slice(0, 240)}"`)
      .join("\n");
    const body = `${answer.answer}\n\n## Sources\n\n${cited}`;
    const r = await saveMarkdownAsDocument(asked, body);
    setSaved(r.ok ? { id: r.id } : { error: r.error });
    setSaving(false);
  }

  function titleOf(sourceId: string) {
    return sources?.find((s) => s.id === sourceId)?.title ?? "A removed source";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && canWrite && !uploading) void upload(file);
  }

  const noModel = answer?.answer.startsWith(NO_MODEL_PREFIX) ?? false;
  const citedSources = new Set(answer?.citations.map((c) => c.sourceId) ?? []);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* ── sources ─────────────────────────────────────────────── */}
      <section aria-labelledby={`${ids}-sources`} className="surface flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${ids}-sources`} className="text-section font-semibold">
            Sources
          </h2>
          {sources && sources.length > 0 && <span className="text-xs text-vayu-muted">{plural(sources.length, "source")}</span>}
        </div>

        {canWrite ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
                dragging ? "border-vayu-accent bg-vayu-accent/[0.06]" : "border-vayu-border-strong/50",
              )}
            >
              <Upload aria-hidden className="h-5 w-5 text-vayu-muted" />
              <p className="text-sm text-vayu-fg">Drop a file here, or</p>
              <Button
                size="sm"
                variant="secondary"
                loading={uploading !== null}
                loadingLabel="Adding…"
                onClick={() => fileInput.current?.click()}
              >
                Choose a file
              </Button>
              <p className="text-xs text-vayu-subtle">
                {RESEARCH_FILE_TYPES.map((t) => t.label).join(", ")} · up to {MAX_UPLOAD_MB} MB
              </p>
              <input
                ref={fileInput}
                type="file"
                accept={RESEARCH_ACCEPT}
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </div>
            {uploading && <Loading label={`Reading "${uploading}"…`} />}
            <form
              noValidate // our own message is clearer and is announced with the field
              onSubmit={(e) => {
                e.preventDefault();
                void addUrl();
              }}
              className="flex flex-col gap-2"
            >
              <Field id={`${ids}-url`} label="Add a web page" error={urlError ?? undefined}>
                {(p) => (
                  <div className="flex gap-2">
                    <Input
                      {...p}
                      type="url"
                      inputMode="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setUrlError(null);
                      }}
                      placeholder="https://…"
                      className="min-w-0 flex-1"
                    />
                    <Button type="submit" variant="secondary" icon={<Globe aria-hidden className="h-4 w-4" />} loading={addingUrl} disabled={!url.trim()}>
                      Add
                    </Button>
                  </div>
                )}
              </Field>
            </form>
          </>
        ) : (
          <Notice tone="info" role="note">
            Your role can ask questions about this workspace&rsquo;s sources. Editors and admins add them.
          </Notice>
        )}

        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        {sourcesError ? (
          <Notice
            tone="danger"
            action={
              <Button size="sm" variant="secondary" icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />} onClick={() => void loadSources()}>
                Retry
              </Button>
            }
          >
            {sourcesError}
          </Notice>
        ) : sources === null ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <Loading srOnly label="Loading sources…" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState
            icon={<Library />}
            headingLevel={3}
            title="No sources yet"
            description="Add a file or a web page. VAYU answers only from what you add here."
            className="py-8"
          />
        ) : (
          <ul aria-label="Your sources" className="flex flex-col gap-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-xl border border-vayu-border bg-vayu-inset/60 px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-vayu-fg">{s.title}</p>
                  <SourceStatus status={s.status} />
                </div>
                <p className="mt-0.5 text-xs text-vayu-muted">
                  {s.sourceType.toUpperCase()} · {plural(s.chunkCount, "passage")}
                  {citedSources.has(s.id) && <span className="text-vayu-accent"> · cited below</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── ask ─────────────────────────────────────────────────── */}
      <section aria-labelledby={`${ids}-ask`} className="flex min-w-0 flex-col gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
          className="surface flex flex-col gap-3 rounded-2xl p-5"
        >
          <h2 id={`${ids}-ask`} className="text-section font-semibold">
            Ask your sources
          </h2>
          <Field
            id={`${ids}-question`}
            label="Question"
            hideLabel
            description={sources?.length === 0 ? "Add a source first; answers come only from your sources." : undefined}
          >
            {(p) => (
              <Textarea
                {...p}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                rows={2}
                placeholder="Ask a question about your sources… (Enter to ask, Shift+Enter for a new line)"
                className="min-h-0"
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              icon={<Search aria-hidden className="h-4 w-4" />}
              loading={asking}
              loadingLabel="Searching your sources…"
              disabled={!question.trim() || !sources || sources.length === 0}
            >
              Ask
            </Button>
          </div>
        </form>

        {askError && <Notice tone="danger">{askError}</Notice>}

        {answer && (
          <article aria-label="Answer" className="surface flex flex-col gap-4 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-overline font-semibold uppercase text-vayu-muted">Answer</p>
                <h3 className="mt-1 break-words text-section font-semibold">{asked}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={answer.answer} withText />
                {canWrite && answer.citations.length > 0 && !noModel && (
                  <Button size="sm" variant="secondary" icon={<FilePlus2 aria-hidden className="h-3.5 w-3.5" />} loading={saving} loadingLabel="Saving…" onClick={() => void saveAnswer()}>
                    Save as document
                  </Button>
                )}
              </div>
            </div>

            {noModel ? (
              <Notice tone="warning" title="No language model is configured">
                VAYU found matching passages (below) but can&rsquo;t write an answer without a model key.{" "}
                <Link href="/status" className="font-medium underline underline-offset-2">
                  Service status
                </Link>{" "}
                shows how to add one.
              </Notice>
            ) : answer.citations.length === 0 ? (
              <Notice tone="warning" title="Nothing in your sources matched">
                There&rsquo;s no grounded answer. Try different words, or add a source that covers this.
              </Notice>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words leading-relaxed text-vayu-fg">{answer.answer}</p>
                <p className="text-xs text-vayu-muted">
                  Based on {plural(answer.citations.length, "passage")} from {plural(citedSources.size, "source")}.
                </p>
              </>
            )}

            {answer.citations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-vayu-fg">Cited passages</h4>
                <ol className="mt-2 flex flex-col gap-2">
                  {answer.citations.map((c, i) => (
                    <li key={`${c.sourceId}-${c.chunkIndex}`} className="rounded-xl border border-vayu-border bg-vayu-inset/60 px-3.5 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-medium text-vayu-fg">
                          <span className="mr-1.5 text-vayu-accent">[{i + 1}]</span>
                          {titleOf(c.sourceId)}
                        </p>
                        <p className="text-xs tabular-nums text-vayu-subtle" title="How closely this passage matches your question, from 0 to 1">
                          Passage {c.chunkIndex + 1} · similarity {c.score.toFixed(2)}
                        </p>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-vayu-fg/85">{c.snippet}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {saved &&
              ("id" in saved ? (
                <p role="status" className="text-sm text-vayu-success">
                  Saved.{" "}
                  <Link href={`/docs/${saved.id}`} className="font-medium underline underline-offset-2">
                    Open the document
                  </Link>
                </p>
              ) : (
                <Notice tone="danger">{saved.error}</Notice>
              ))}
          </article>
        )}
      </section>
    </div>
  );
}
