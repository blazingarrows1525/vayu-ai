"use client";

import { useState } from "react";
import Link from "next/link";
import { type Editor, VayuEditor } from "@vayu/editor";
import { CopilotPanel } from "@/components/copilot-panel";

const INITIAL = `
<h1>VAYU Editor</h1>
<p>An AI-native block editor. Press <code>/</code> anywhere for the command menu — headings, lists, tables, code, math, callouts, and Mermaid diagrams.</p>
<div data-type="callout" data-variant="success"><p>Tip: type <code>/diagram</code> for a Mermaid flowchart, or <code>/math</code> for a LaTeX block.</p></div>
<blockquote><p>Intelligence at the speed of thought.</p></blockquote>
<pre><code class="language-typescript">export const vayu = { plane: "product", ready: true };</code></pre>
`;

export default function EditorDemoPage() {
  const [blocks, setBlocks] = useState<number | null>(null);
  const [editedAt, setEditedAt] = useState<string>("");
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Editor</h1>
        </div>
        <Link href="/" className="text-sm text-vayu-muted transition hover:text-vayu-fg">
          ← Home
        </Link>
      </header>

      <div className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
        <VayuEditor
          content={INITIAL}
          autofocus
          onCreate={setEditor}
          onUpdate={(json) => {
            setBlocks(Array.isArray(json.content) ? json.content.length : 0);
            setEditedAt(new Date().toLocaleTimeString());
          }}
        />
      </div>

      <div className="mt-4">
        <CopilotPanel editor={editor} />
      </div>

      <p className="mt-4 text-xs text-vayu-muted">
        {blocks === null
          ? "Start typing — press / for the command menu."
          : `${blocks} top-level blocks`}
        {editedAt && ` · edited ${editedAt}`}
      </p>
    </main>
  );
}
