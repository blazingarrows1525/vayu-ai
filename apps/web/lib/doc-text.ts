/** Plain text of a Tiptap/ProseMirror JSON document (block nodes separated by newlines). */
export function extractText(json: unknown): string {
  const node = json as { type?: string; text?: string; content?: unknown[] } | null;
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (Array.isArray(node.content)) {
    return node.content
      .map(extractText)
      .join(node.type === "paragraph" || node.type === "heading" ? "\n" : "");
  }
  return "";
}
