"use client";

import "katex/dist/katex.min.css";
import "./styles.css";

import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { useEffect } from "react";
import { vayuExtensions } from "./extensions";

function GripIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  );
}

export interface VayuEditorProps {
  content?: JSONContent | string;
  editable?: boolean;
  placeholder?: string;
  autofocus?: boolean;
  className?: string;
  onUpdate?: (json: JSONContent) => void;
  onCreate?: (editor: Editor) => void;
}

/**
 * The VAYU block editor. Client-only (Tiptap), SSR-safe via immediatelyRender:false.
 */
export function VayuEditor({
  content,
  editable = true,
  placeholder,
  autofocus = false,
  className,
  onUpdate,
  onCreate,
}: VayuEditorProps) {
  const editor = useEditor({
    extensions: vayuExtensions({ placeholder }),
    content: content ?? "",
    editable,
    autofocus,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "vayu-prose", spellcheck: "true" },
    },
    onCreate: ({ editor }) => onCreate?.(editor),
    onUpdate: ({ editor }) => onUpdate?.(editor.getJSON()),
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div style={{ position: "relative" }}>
      <EditorContent editor={editor} className={className} />
      {editor && (
        <DragHandle editor={editor} className="vayu-drag-handle">
          <GripIcon />
        </DragHandle>
      )}
    </div>
  );
}
