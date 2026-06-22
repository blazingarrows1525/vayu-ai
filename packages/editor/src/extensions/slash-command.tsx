import { type Editor, Extension, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

export interface SlashItem {
  title: string;
  description: string;
  icon: string;
  searchTerms: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

const ITEMS: SlashItem[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: "¶",
    searchTerms: ["paragraph", "text", "p"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Big section heading",
    icon: "H1",
    searchTerms: ["title", "h1", "heading"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium heading",
    icon: "H2",
    searchTerms: ["h2", "heading", "subtitle"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small heading",
    icon: "H3",
    searchTerms: ["h3", "heading"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "Unordered list",
    icon: "•",
    searchTerms: ["unordered", "bullet", "list", "ul"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Ordered list",
    icon: "1.",
    searchTerms: ["ordered", "numbered", "list", "ol"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    description: "Track tasks with checkboxes",
    icon: "☑",
    searchTerms: ["todo", "task", "checkbox", "check"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Capture a quotation",
    icon: "❝",
    searchTerms: ["blockquote", "quote"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Syntax-highlighted code",
    icon: "</>",
    searchTerms: ["code", "pre", "snippet"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Callout",
    description: "Make text stand out",
    icon: "💡",
    searchTerms: ["callout", "info", "note", "admonition"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCallout({ variant: "info" }).run(),
  },
  {
    title: "Table",
    description: "3×3 table with header",
    icon: "▦",
    searchTerms: ["table", "grid"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Image",
    description: "Embed by URL",
    icon: "🖼",
    searchTerms: ["image", "picture", "photo", "img"],
    command: ({ editor, range }) => {
      const url = window.prompt("Image URL");
      editor.chain().focus().deleteRange(range).run();
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    title: "Math block",
    description: "LaTeX equation",
    icon: "∑",
    searchTerms: ["math", "latex", "katex", "equation", "formula"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertBlockMath({ latex: "\\int_0^1 x^2\\,dx" })
        .run(),
  },
  {
    title: "Diagram",
    description: "Mermaid flowchart",
    icon: "❖",
    searchTerms: ["mermaid", "diagram", "flowchart", "graph"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setMermaid("graph TD;\n  A[Start] --> B{Ready?};\n  B -->|yes| C[Ship];\n  B -->|no| A;")
        .run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: "—",
    searchTerms: ["divider", "hr", "rule", "separator"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

function filterItems(query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return ITEMS;
  return ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.searchTerms.some((t) => t.includes(q)),
  ).slice(0, 10);
}

interface SlashMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>((props, ref) => {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!props.items.length) return false;
      if (event.key === "ArrowDown") {
        setSelected((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((i) => (i + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = props.items[selected];
        if (item) props.command(item);
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return <div className="vayu-slash-menu vayu-slash-empty">No matches</div>;
  }

  return (
    <div className="vayu-slash-menu">
      {props.items.map((item, i) => (
        <button
          type="button"
          key={item.title}
          className={`vayu-slash-item${i === selected ? " is-selected" : ""}`}
          onMouseEnter={() => setSelected(i)}
          onClick={() => props.command(item)}
        >
          <span className="vayu-slash-ico">{item.icon}</span>
          <span className="vayu-slash-text">
            <span className="vayu-slash-title">{item.title}</span>
            <span className="vayu-slash-desc">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
});
SlashMenu.displayName = "SlashMenu";

type SlashSuggestion = Omit<SuggestionOptions<SlashItem>, "editor">;

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => filterItems(query),
        render: () => {
          let component: ReactRenderer<SlashMenuRef, SlashMenuProps>;
          let popup: HTMLDivElement;

          const place = (rect: DOMRect | null | undefined) => {
            if (!rect || !popup) return;
            popup.style.left = `${rect.left + window.scrollX}px`;
            popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
          };

          return {
            onStart: (props: SuggestionProps<SlashItem>) => {
              component = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
                },
              });
              popup = document.createElement("div");
              popup.className = "vayu-slash-popup";
              popup.style.position = "absolute";
              popup.style.zIndex = "50";
              document.body.appendChild(popup);
              popup.appendChild(component.element);
              place(props.clientRect?.());
            },
            onUpdate: (props: SuggestionProps<SlashItem>) => {
              component.updateProps({
                items: props.items,
                command: (item: SlashItem) => props.command(item),
              });
              place(props.clientRect?.());
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") return true;
              return component.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.remove();
              component?.destroy();
            },
          };
        },
      } as SlashSuggestion,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
