"use client";

import "katex/dist/katex.min.css";
import "./styles.css";

import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { vayuExtensions } from "./extensions";

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

  return <EditorContent editor={editor} className={className} />;
}
