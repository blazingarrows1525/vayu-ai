import { describe, expect, it } from "vitest";
import { inline, markdownToDoc } from "./markdown-to-doc";

describe("markdownToDoc", () => {
  it("returns nothing for empty input", () => {
    expect(markdownToDoc("")).toEqual([]);
    expect(markdownToDoc("\n\n  \n")).toEqual([]);
  });

  it("turns headings, lists and paragraphs into blocks", () => {
    const doc = markdownToDoc("## Launch plan\n\nShip on **Friday**.\n\n- Write docs\n- Tell *everyone*\n\n3. Third\n4. Fourth");
    expect(doc.map((b) => b.type)).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    expect(doc[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Launch plan" }] });
    expect(doc[1]!.content).toEqual([
      { type: "text", text: "Ship on " },
      { type: "text", text: "Friday", marks: [{ type: "bold" }] },
      { type: "text", text: "." },
    ]);
    expect(doc[2]!.content).toHaveLength(2);
    expect(doc[3]!.attrs).toEqual({ start: 3 });
  });

  it("keeps single newlines inside a paragraph as line breaks", () => {
    const [p] = markdownToDoc("Hi Sam,\nThanks for the notes.");
    expect(p!.content!.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
  });

  it("keeps fenced code verbatim, with its language", () => {
    const [code] = markdownToDoc("```ts\nconst a = 1 * 2 * 3;\n**not bold**\n```");
    expect(code).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1 * 2 * 3;\n**not bold**" }],
    });
  });

  it("nests block quotes and recognises horizontal rules", () => {
    const doc = markdownToDoc("> quoted *line*\n\n---\n\nafter");
    expect(doc.map((b) => b.type)).toEqual(["blockquote", "horizontalRule", "paragraph"]);
    expect(doc[0]!.content![0]!.type).toBe("paragraph");
  });
});

describe("inline", () => {
  it("marks bold, italic and code", () => {
    expect(inline("a **b** _c_ `d`")).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "c", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "d", marks: [{ type: "code" }] },
    ]);
  });

  it("leaves snake_case and arithmetic alone", () => {
    expect(inline("rename user_id_value")).toEqual([{ type: "text", text: "rename user_id_value" }]);
    expect(inline("2*3*4 = 24")).toEqual([{ type: "text", text: "2*3*4 = 24" }]);
  });
});
