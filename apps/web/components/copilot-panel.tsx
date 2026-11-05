"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDownToLine, Replace, Sparkles, Square, X } from "lucide-react";
import type { Editor, JSONContent } from "@vayu/editor";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { formatUsd, plural } from "@/lib/format";
import { markdownToDoc } from "@/lib/markdown-to-doc";
import { useCopilot } from "@/lib/use-copilot";

const EDIT_COMMANDS = [
  { value: "/improve", label: "Improve writing" },
  { value: "/rewrite", label: "Rewrite" },
  { value: "/fix-grammar", label: "Fix grammar" },
  { value: "/shorten", label: "Make shorter" },
  { value: "/expand", label: "Make longer" },
  { value: "/summarize", label: "Summarize" },
  { value: "/continue", label: "Continue writing" },
  { value: "/change-tone", label: "Change tone" },
];
const GENERATE_COMMANDS = [
  { value: "/generate-outline", label: "Outline" },
  { value: "/generate-blog", label: "Blog post" },
  { value: "/generate-email", label: "Email" },
  { value: "/generate-docs", label: "Technical doc" },
];

// No `model` lets the AI plane use that provider's configured model; no `provider` lets it use
// the workspace default (with failover). Providers without a key fail with a clear message.
type ModelChoice = { id: string; label: string; provider?: string; model?: string };
const MODELS: ModelChoice[] = [
  { id: "default", label: "Workspace default" },
  { id: "gemini-flash", label: "Gemini 2.5 Flash (fast)", provider: "gemini", model: "gemini-2.5-flash" },
  { id: "gemini-pro", label: "Gemini 2.5 Pro", provider: "gemini", model: "gemini-2.5-pro" },
  { id: "nvidia-405b", label: "Llama 3.1 405B (NVIDIA)", provider: "nvidia", model: "meta/llama-3.1-405b-instruct" },
  { id: "nvidia-70b", label: "Llama 3.1 70B (NVIDIA)", provider: "nvidia", model: "meta/llama-3.1-70b-instruct" },
  { id: "nvidia-8b", label: "Llama 3.1 8B (NVIDIA)", provider: "nvidia", model: "meta/llama-3.1-8b-instruct" },
  { id: "openai", label: "GPT-4o (OpenAI)", provider: "openai", model: "gpt-4o" },
  { id: "anthropic", label: "Claude (Anthropic)", provider: "anthropic" },
];

/** A model's reply as editor content: one paragraph stays inline (so replacing part of a
 *  sentence keeps it a sentence); anything else becomes blocks. */
function toContent(text: string): JSONContent[] {
  const blocks = markdownToDoc(text);
  if (blocks.length === 1 && blocks[0]!.type === "paragraph") return blocks[0]!.content ?? [];
  return blocks;
}

/**
 * Copilot for a document or the scratchpad: pick an action, run it on the selection (or the whole
 * text), read the result, then insert it, replace the selection with it, or copy it.
 */
export function CopilotPanel({
  editor,
  documentId,
  canInsert = true,
}: {
  editor: Editor | null;
  documentId?: string;
  canInsert?: boolean;
}) {
  const ids = useId();
  const { text, status, streaming, error, usage, run, stop, reset } = useCopilot();
  const [command, setCommand] = useState("/improve");
  const [instruction, setInstruction] = useState("");
  const [modelId, setModelId] = useState("default");
  const [selectionChars, setSelectionChars] = useState(0);
  const [docChars, setDocChars] = useState(0);
  const [inserted, setInserted] = useState<string | null>(null);

  const isGenerate = command.startsWith("/generate");
  const needsTone = command === "/change-tone";
  const choice = MODELS.find((m) => m.id === modelId) ?? MODELS[0]!;
  const placeholderOutput = usage?.configured === false;

  // Track what Copilot will work on, so the scope line is always true.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const { from, to } = editor.state.selection;
      setSelectionChars(editor.state.doc.textBetween(from, to, "\n").length);
      setDocChars(editor.getText().trim().length);
    };
    sync();
    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [editor]);

  const scope = isGenerate
    ? instruction.trim()
      ? "Writes new text from your topic, using the document as background."
      : "Writes new text from the document. Add a topic to steer it."
    : selectionChars > 0
      ? `Works on your selection (${plural(selectionChars, "character")}).`
      : docChars > 0
        ? "Works on the whole text. Select a passage to focus it."
        : "Write something first, or choose a Generate action.";
  const canRun = !!editor && !streaming && (isGenerate || docChars > 0) && (!needsTone || instruction.trim().length > 0);

  function source(): string {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n") || editor.getText();
  }

  async function onRun() {
    if (!canRun) return;
    setInserted(null);
    const selection = source();
    await run({
      command,
      selection: isGenerate ? undefined : selection,
      context: isGenerate ? instruction.trim() || selection : undefined,
      tone: needsTone ? instruction.trim() : undefined,
      documentId,
      model: choice.model,
      provider: choice.provider,
    });
  }

  function replaceSelection() {
    if (!editor || !text) return;
    const { from, to } = editor.state.selection;
    editor.chain().focus().insertContentAt({ from, to }, toContent(text)).run();
    setInserted("Replaced the selection.");
  }

  function insertBelow() {
    if (!editor || !text) return;
    const { $to } = editor.state.selection;
    const at = $to.depth >= 1 ? $to.after(1) : editor.state.doc.content.size;
    editor.chain().focus().insertContentAt(at, markdownToDoc(text)).run();
    setInserted("Inserted below the current paragraph.");
  }

  const showOutput = streaming || text.length > 0 || error !== null;

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onRun();
        }}
        className="flex flex-col gap-3"
      >
        <Field id={`${ids}-action`} label="Action">
          {(p) => (
            <Select {...p} value={command} onChange={(e) => setCommand(e.target.value)}>
              <optgroup label="Edit">
                {EDIT_COMMANDS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Generate">
                {GENERATE_COMMANDS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        {(isGenerate || needsTone) && (
          <Field id={`${ids}-instruction`} label={needsTone ? "Tone" : "Topic"} required={needsTone}>
            {(p) => (
              <Input
                {...p}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={needsTone ? "e.g. friendly, formal, concise" : "e.g. launch announcement for the Q4 release"}
              />
            )}
          </Field>
        )}
        <Field id={`${ids}-model`} label="Model">
          {(p) => (
            <Select {...p} value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-xs leading-relaxed text-vayu-muted">{scope}</p>
        <div className="flex gap-2">
          {streaming ? (
            <Button variant="secondary" block icon={<Square aria-hidden className="h-3.5 w-3.5" />} onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="primary" block icon={<Sparkles aria-hidden className="h-4 w-4" />} disabled={!canRun}>
              Run Copilot
            </Button>
          )}
        </div>
      </form>

      {showOutput && (
        <section aria-label="Copilot result" className="flex flex-col gap-3">
          {error && <Notice tone="danger">{error}</Notice>}
          {placeholderOutput && (
            <Notice tone="warning" title="No model key is configured">
              This is placeholder text, not a real answer, so it can&rsquo;t be inserted. Service status shows how to add a key.
            </Notice>
          )}
          {(text || streaming) && (
            <div
              aria-live="polite"
              aria-busy={streaming}
              className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-vayu-border bg-vayu-inset px-3.5 py-3 text-sm leading-relaxed text-vayu-fg"
            >
              {text || <span className="text-vayu-muted">Writing…</span>}
              {streaming && text && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-blink-soft rounded-sm bg-vayu-accent align-text-bottom" />}
            </div>
          )}
          {status === "stopped" && <p className="text-xs text-vayu-muted">Stopped. The text so far is kept.</p>}
          {text && !streaming && (
            <div className="flex flex-wrap items-center gap-2">
              {canInsert && !placeholderOutput && (
                <>
                  {selectionChars > 0 && (
                    <Button size="sm" variant="secondary" icon={<Replace aria-hidden className="h-3.5 w-3.5" />} onClick={replaceSelection}>
                      Replace selection
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={<ArrowDownToLine aria-hidden className="h-3.5 w-3.5" />} onClick={insertBelow}>
                    Insert below
                  </Button>
                </>
              )}
              <CopyButton value={text} withText />
              <Button size="sm" variant="ghost" icon={<X aria-hidden className="h-3.5 w-3.5" />} onClick={() => { reset(); setInserted(null); }}>
                Discard
              </Button>
            </div>
          )}
          {inserted && (
            <p role="status" className="text-xs font-medium text-vayu-success">
              {inserted}
            </p>
          )}
          {usage && !streaming && (
            <p className="text-xs text-vayu-subtle">
              {usage.model} · {plural(usage.promptTokens + usage.completionTokens, "token")} · {formatUsd(usage.costUsd)}
              {usage.cached ? " · from cache" : ""}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
