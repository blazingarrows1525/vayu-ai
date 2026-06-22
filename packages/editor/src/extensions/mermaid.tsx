import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (code?: string) => ReturnType;
    };
  }
}

// Lazy-load mermaid so it stays out of the initial bundle.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

function MermaidView({ node, updateAttributes, editor }: NodeViewProps) {
  const code = (node.attrs.code as string) ?? "";
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!code);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    if (!code.trim()) {
      setSvg("");
      setError(null);
      return;
    }
    getMermaid()
      .then((mermaid) => mermaid.render(idRef.current, code))
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const showSource = editing || !!error;

  return (
    <NodeViewWrapper className="vayu-mermaid" data-type="mermaid">
      {showSource && (
        <textarea
          className="vayu-mermaid-src"
          value={code}
          spellCheck={false}
          placeholder={"graph TD;\n  A[Start] --> B[Done];"}
          onChange={(e) => updateAttributes({ code: e.target.value })}
        />
      )}
      {error && <pre className="vayu-mermaid-error">{error}</pre>}
      {!showSource && svg && (
        // eslint-disable-next-line react/no-danger
        <div className="vayu-mermaid-preview" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      {editor.isEditable && (
        <button
          type="button"
          className="vayu-mermaid-toggle"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Preview" : "Edit"}
        </button>
      )}
    </NodeViewWrapper>
  );
}

/** A fenced diagram block rendered with Mermaid. */
export const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { code: { default: "" } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mermaid" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },

  addCommands() {
    return {
      setMermaid:
        (code = "") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { code } }),
    };
  },
});
