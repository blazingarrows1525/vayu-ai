"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { Clapperboard, FilePlus2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { saveMarkdownAsDocument } from "@/lib/save-as-document";

const MAX_MB = 25;

/** Pick a short video (button or drop), summarise it, then copy the summary or keep it as a document. */
export function VideoSummarizer({ canSave }: { canSave: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; status?: number } | null>(null);
  const [saved, setSaved] = useState<{ id: string } | { error: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function choose(next: File | undefined) {
    if (!next) return;
    setError(null);
    setSummary(null);
    setSaved(null);
    if (!next.type.startsWith("video/")) {
      setError({ text: `"${next.name}" isn't a video file.` });
      return;
    }
    if (next.size > MAX_MB * 1024 * 1024) {
      setError({ text: `"${next.name}" is ${(next.size / 1048576).toFixed(1)} MB; the limit is ${MAX_MB} MB. Trim it to a shorter clip.` });
      return;
    }
    setFile(next);
  }

  async function summarise() {
    if (!file || working) return;
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media/video", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { summary?: string; detail?: unknown; error?: unknown };
      if (!res.ok || typeof data.summary !== "string") {
        const detail = typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : null;
        setError({
          status: res.status,
          text:
            res.status === 503
              ? "Video summaries aren't set up on the AI service yet."
              : res.status === 422
                ? "That file couldn't be read as a video. Try an MP4, MOV or WebM file."
                : (detail ?? `The video couldn't be summarised (error ${res.status}).`),
        });
        return;
      }
      setSummary(data.summary);
    } catch {
      setError({ text: "Couldn't reach VAYU. Your file is still selected; try again." });
    } finally {
      setWorking(false);
    }
  }

  async function save() {
    if (!summary || !file) return;
    setSaving(true);
    const r = await saveMarkdownAsDocument(`Summary: ${file.name}`, summary);
    setSaved(r.ok ? { id: r.id } : { error: r.error });
    setSaving(false);
  }

  function reset() {
    setFile(null);
    setSummary(null);
    setError(null);
    setSaved(null);
    if (input.current) input.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!working) choose(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex flex-col gap-5">
      {!summary && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "surface flex flex-col items-center gap-3 rounded-2xl border-dashed px-6 py-10 text-center transition-colors",
            dragging && "border-vayu-accent bg-vayu-accent/[0.05]",
          )}
        >
          <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl border border-vayu-accent/25 bg-vayu-accent/10 text-vayu-accent">
            <Clapperboard className="h-5 w-5" />
          </span>
          {file ? (
            <>
              <p className="max-w-full break-words text-sm font-medium text-vayu-fg">{file.name}</p>
              <p className="text-xs text-vayu-muted">{(file.size / 1048576).toFixed(1)} MB</p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <Button variant="primary" loading={working} loadingLabel="Summarising…" onClick={() => void summarise()}>
                  Summarise video
                </Button>
                <Button variant="ghost" disabled={working} onClick={() => input.current?.click()}>
                  Choose another
                </Button>
              </div>
              {working && <p className="text-xs text-vayu-muted">This can take up to a minute for longer clips.</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-vayu-fg">Drop a video here, or</p>
              <Button variant="secondary" icon={<Upload aria-hidden className="h-4 w-4" />} onClick={() => input.current?.click()}>
                Choose a video
              </Button>
              <p className="text-xs text-vayu-subtle">MP4, MOV or WebM · up to {MAX_MB} MB</p>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept="video/*"
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </div>
      )}

      {error && (
        <Notice
          tone="danger"
          action={
            file && !summary && error.status !== 503 ? (
              <Button size="sm" variant="secondary" icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />} onClick={() => void summarise()}>
                Try again
              </Button>
            ) : undefined
          }
        >
          {error.text}
          {error.status === 503 && (
            <>
              {" "}
              <Link href="/status" className="font-medium underline underline-offset-2">
                Service status
              </Link>{" "}
              shows what&rsquo;s missing.
            </>
          )}
        </Notice>
      )}

      {summary && (
        <article aria-label="Summary" className="surface flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-overline font-semibold uppercase text-vayu-muted">Summary</p>
              <h2 className="mt-1 break-words text-section font-semibold">{file?.name}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={summary} withText />
              {canSave && (
                <Button size="sm" variant="secondary" icon={<FilePlus2 aria-hidden className="h-3.5 w-3.5" />} loading={saving} loadingLabel="Saving…" onClick={() => void save()}>
                  Save as document
                </Button>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap break-words leading-relaxed text-vayu-fg">{summary}</p>
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
          <div>
            <Button size="sm" variant="ghost" onClick={reset}>
              Summarise another video
            </Button>
          </div>
        </article>
      )}
    </div>
  );
}
