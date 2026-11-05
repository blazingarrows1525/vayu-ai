"use client";

import { markdownToDoc } from "./markdown-to-doc";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Creates a document from Markdown (an agent result, a research answer, a summary). */
export async function saveMarkdownAsDocument(title: string, markdown: string): Promise<SaveResult> {
  const cleanTitle = title.trim().slice(0, 120) || "Untitled";
  try {
    const created = await fetch("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: cleanTitle }),
    });
    if (!created.ok) {
      return {
        ok: false,
        error:
          created.status === 403
            ? "Your role in this workspace can't create documents."
            : `The document wasn't created (error ${created.status}).`,
      };
    }
    const { id } = (await created.json()) as { id: string };
    const content = { type: "doc", content: markdownToDoc(markdown) };
    const saved = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: cleanTitle, content, contentText: markdown }),
    });
    if (!saved.ok) return { ok: false, error: `A document was created but the text wasn't saved (error ${saved.status}).` };
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Couldn't reach VAYU. Check your connection and try again." };
  }
}
