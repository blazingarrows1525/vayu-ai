import type { JSONContent } from "@vayu/editor";

/**
 * Converts the Markdown that language models usually answer in into editor blocks, so inserting
 * a Copilot result gives real headings and lists instead of literal "##" and "**". Covers the
 * common subset: ATX headings, bullet/ordered lists, block quotes, fenced code, horizontal rules,
 * paragraphs (single newlines kept as line breaks) and inline bold, italic and code.
 */
export function markdownToDoc(markdown: string): JSONContent[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: JSONContent[] = [];
  const paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push(toParagraph(paragraph.splice(0)));
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) body.push(lines[i++]!);
      i++; // closing fence (or end of input)
      const code = body.join("\n");
      blocks.push({ type: "codeBlock", attrs: { language: fence[1] || null }, content: code ? [{ type: "text", text: code }] : [] });
      continue;
    }

    if (!line.trim()) {
      flush();
      i++;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", attrs: { level: heading[1]!.length }, content: inline(heading[2]!) });
      i++;
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      flush();
      const quoted: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) quoted.push(lines[i++]!.replace(/^\s{0,3}>\s?/, ""));
      blocks.push({ type: "blockquote", content: markdownToDoc(quoted.join("\n")) });
      continue;
    }

    const BULLET = /^\s*[-*+]\s+(.*)$/;
    const ORDERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;
    const ordered = line.match(ORDERED);
    if (ordered || BULLET.test(line)) {
      flush();
      const pattern = ordered ? ORDERED : BULLET;
      const items: JSONContent[] = [];
      while (i < lines.length && pattern.test(lines[i]!)) {
        const m = lines[i++]!.match(pattern)!;
        items.push({ type: "listItem", content: [{ type: "paragraph", content: inline(ordered ? m[2]! : m[1]!) }] });
      }
      blocks.push(
        ordered
          ? { type: "orderedList", attrs: { start: Number(ordered[1]) }, content: items }
          : { type: "bulletList", content: items },
      );
      continue;
    }

    paragraph.push(line);
    i++;
  }
  flush();
  return blocks;
}

function toParagraph(lines: string[]): JSONContent {
  const content: JSONContent[] = [];
  lines.forEach((line, index) => {
    if (index > 0) content.push({ type: "hardBreak" });
    content.push(...inline(line.trim()));
  });
  return { type: "paragraph", content };
}

// **bold** / __bold__, `code`, *italic* / _italic_ — underscores and single stars only count at
// word boundaries, so snake_case names and 2*3*4 stay literal.
const INLINE = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])|(?<!\w)_(?!\s)([^_\n]+?)_(?!\w)/g;

export function inline(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", text: text.slice(last, at) });
    const [, bold, bold2, code, italic, italic2] = m;
    if (bold ?? bold2) out.push({ type: "text", text: (bold ?? bold2)!, marks: [{ type: "bold" }] });
    else if (code) out.push({ type: "text", text: code, marks: [{ type: "code" }] });
    else out.push({ type: "text", text: (italic ?? italic2)!, marks: [{ type: "italic" }] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.filter((node) => node.text);
}
