"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem<T extends string> = { id: T; label: ReactNode; badge?: ReactNode };

/**
 * ARIA tabs with a roving tab stop: Tab enters the list at the selected tab, arrow keys (and
 * Home/End) move between tabs and select them. Render each panel with <TabPanel>.
 */
export function Tabs<T extends string>({
  idBase,
  items,
  value,
  onChange,
  label,
  className,
}: {
  idBase: string;
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
}) {
  const refs = useRef<Map<T, HTMLButtonElement>>(new Map());

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = items[next]!.id;
    onChange(id);
    refs.current.get(id)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 rounded-xl border border-vayu-border bg-vayu-inset/70 p-1", className)}
    >
      {items.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el);
              else refs.current.delete(t.id);
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:min-h-11",
              selected
                ? "bg-vayu-surface text-vayu-fg shadow-card"
                : "text-vayu-muted hover:bg-vayu-fg/[0.05] hover:text-vayu-fg",
            )}
          >
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

/** A tab's panel. Hidden panels stay mounted, so their state (a stream, a draft) survives switching. */
export function TabPanel<T extends string>({
  idBase,
  id,
  value,
  className,
  children,
}: {
  idBase: string;
  id: T;
  value: T;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${id}`}
      aria-labelledby={`${idBase}-tab-${id}`}
      hidden={id !== value}
      tabIndex={0}
      className={cn("focus-visible:outline-offset-4", className)}
    >
      {children}
    </div>
  );
}
