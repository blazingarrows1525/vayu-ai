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

// No `model` lets the AI plane use that provider's configured model; no `provider`
// lets it use the workspace default (with failover).
type ModelChoice = { id: string; label: string; provider?: string; model?: string };
const DEFAULT_MODEL: ModelChoice = { id: "default", label: "Workspace default (Gemini)" };
const MODELS: ModelChoice[] = [
  DEFAULT_MODEL,
  { id: "gemini-flash", label: "Gemini 2.5 Flash — fast", provider: "gemini", model: "gemini-2.5-flash" },
  { id: "gemini-pro", label: "Gemini 2.5 Pro", provider: "gemini", model: "gemini-2.5-pro" },
  { id: "nvidia-405b", label: "NVIDIA Llama 3.1 405B", provider: "nvidia", model: "meta/llama-3.1-405b-instruct" },
  { id: "nvidia-70b", label: "NVIDIA Llama 3.1 70B", provider: "nvidia", model: "meta/llama-3.1-70b-instruct" },
  { id: "nvidia-8b", label: "NVIDIA Llama 3.1 8B", provider: "nvidia", model: "meta/llama-3.1-8b-instruct" },
  { id: "openai", label: "GPT-4o", provider: "openai", model: "gpt-4o" },
  { id: "anthropic", label: "Claude", provider: "anthropic" },
];

const inputClass =
  "rounded-lg border border-vayu-border bg-vayu-bg px-2 py-1.5 text-sm text-vayu-fg outline-none focus:border-vayu-accent";

export function CopilotPanel({ editor }: { editor: Editor | null }) {
  const { text, streaming, usage, run } = useCopilot();
  const [command, setCommand] = useState("/improve");
  const [instruction, setInstruction] = useState("");

  const [modelId, setModelId] = useState("default");
  const choice = MODELS.find((m) => m.id === modelId) ?? DEFAULT_MODEL;

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
      model: choice.model,
      provider: choice.provider,
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
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className={inputClass}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
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
