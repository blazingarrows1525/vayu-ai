"use client";

import { useState } from "react";
import type { Editor } from "@vayu/editor";
import { useCopilot } from "@/lib/use-copilot";

const COMMANDS: { value: string; label: string }[] = [
  { value: "/improve", label: "Improve" },
  { value: "/rewrite", label: "Rewrite" },
  { value: "/fix-grammar", label: "Fix grammar" },
  { value: "/shorten", label: "Shorten" },
  { value: "/expand", label: "Expand" },
  { value: "/summarize", label: "Summarize" },
  { value: "/continue", label: "Continue" },
  { value: "/change-tone", label: "Change tone" },
  { value: "/generate-outline", label: "Outline" },
  { value: "/generate-blog", label: "Blog post" },
  { value: "/generate-email", label: "Email" },
  { value: "/generate-docs", label: "Docs" },
];

const inputClass =
  "rounded-lg border border-vayu-border bg-vayu-bg px-2 py-1.5 text-sm text-vayu-fg outline-none focus:border-vayu-accent";

export function CopilotPanel({ editor }: { editor: Editor | null }) {
  const { text, streaming, usage, run } = useCopilot();
  const [command, setCommand] = useState("/improve");
  const [instruction, setInstruction] = useState("");

  const isGenerate = command.startsWith("/generate");
  const needsTone = command === "/change-tone";

  function selectionText(): string {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n") || editor.getText();
  }

  async function onRun() {
    if (!editor) return;
    const selection = selectionText();
    await run({
      command,
      selection: isGenerate ? undefined : selection,
      context: isGenerate ? instruction || selection : undefined,
      tone: needsTone ? instruction : undefined,
    });
  }

  function insert() {
    if (!editor || !text) return;
    editor.chain().focus().insertContent(text).run();
  }

  return (
    <div className="rounded-2xl border border-vayu-border bg-vayu-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-vayu-accent">
          Copilot
        </span>
        <select
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className={inputClass}
        >
          {COMMANDS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {(isGenerate || needsTone) && (
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={needsTone ? "tone (e.g. formal)" : "topic / instruction"}
            className={`${inputClass} min-w-[12rem] flex-1`}
          />
        )}
        <button
          onClick={onRun}
          disabled={streaming || !editor}
          className="rounded-lg bg-vayu-accent px-3 py-1.5 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
        >
          {streaming ? "Streaming…" : "Run"}
        </button>
      </div>

      {(text || streaming) && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-vayu-border bg-vayu-bg p-3 text-sm text-vayu-fg">
          {text || "…"}
        </div>
      )}

      {(text || usage) && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-vayu-muted">
            {usage
              ? `${usage.model} · ${usage.promptTokens + usage.completionTokens} tok · $${usage.costUsd.toFixed(4)}${usage.cached ? " · cached" : ""}${usage.configured === false ? " · no key set" : ""}`
              : ""}
          </p>
          <button
            onClick={insert}
            disabled={!text || streaming}
            className="rounded-lg border border-vayu-border px-3 py-1 text-xs text-vayu-muted transition hover:border-vayu-accent hover:text-vayu-fg disabled:opacity-50"
          >
            Insert at cursor
          </button>
        </div>
      )}
    </div>
  );
}
