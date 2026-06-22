import StarterKit from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { common, createLowlight } from "lowlight";
import type { Extensions } from "@tiptap/core";
import { Callout } from "./callout";
import { Mermaid } from "./mermaid";
import { SlashCommand } from "./slash-command";

const lowlight = createLowlight(common);

export interface VayuExtensionOptions {
  placeholder?: string;
}

/** The full VAYU editor extension set. Composed so apps can extend it. */
export function vayuExtensions(options: VayuExtensionOptions = {}): Extensions {
  const { placeholder = "Type '/' for commands…" } = options;

  return [
    // StarterKit bundles paragraph, headings, lists, bold/italic/strike, link,
    // underline, blockquote, hr, code, history, etc. We swap its code block for
    // a syntax-highlighted one.
    StarterKit.configure({ codeBlock: false }),
    Placeholder.configure({ placeholder, includeChildren: true }),
    CodeBlockLowlight.configure({ lowlight }),
    Image.configure({ inline: false, allowBase64: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Mathematics,
    Callout,
    Mermaid,
    SlashCommand,
  ];
}

export { Callout, Mermaid, SlashCommand };
export type { SlashItem } from "./slash-command";
export type { CalloutVariant } from "./callout";
