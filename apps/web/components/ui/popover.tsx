"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/cn";

export type PopoverTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  popoverTarget: string;
  "aria-haspopup": "dialog";
  "aria-expanded": boolean;
  "aria-controls": string;
  onPointerDown: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A panel anchored under its trigger, on the native popover API: the browser handles light
 * dismiss (outside click, Escape), the top layer, and focus order (the panel follows its trigger,
 * and Escape returns focus to it). Opening from the keyboard moves focus to the first item.
 * Following a link, or activating anything marked `data-popover-close`, closes it.
 */
export function Popover({
  label,
  align = "start",
  trigger,
  className,
  children,
}: {
  /** Accessible name of the panel. */
  label: string;
  align?: "start" | "end";
  trigger: (props: PopoverTriggerProps) => ReactNode;
  className?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const viaPointer = useRef(false);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    const panel = panelRef.current;
    if (panel?.matches(":popover-open")) panel.hidePopover();
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Before it shows: anchor to the trigger's edge, so it never paints at the default position.
    function onBeforeToggle(e: Event) {
      if ((e as ToggleEvent).newState !== "open" || !panel) return;
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth;
      panel.style.top = `${Math.round(r.bottom + 8)}px`;
      if (align === "end") {
        panel.style.right = `${Math.max(8, Math.round(vw - r.right))}px`;
        panel.style.left = "auto";
      } else {
        panel.style.left = `${Math.max(8, Math.round(r.left))}px`;
        panel.style.right = "auto";
      }
    }

    function onToggle(e: Event) {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (!isOpen || !panel) return;
      // Keep it on screen on narrow viewports. Layout width (offsetWidth), not the bounding box:
      // the entrance animation scales the panel, which would understate its size.
      const vw = document.documentElement.clientWidth;
      const width = panel.offsetWidth;
      if (align === "end") {
        const right = Number.parseFloat(panel.style.right) || 8;
        if (vw - right - width < 8) {
          panel.style.left = "8px";
          panel.style.right = "auto";
        }
      } else {
        const left = Number.parseFloat(panel.style.left) || 8;
        if (left + width > vw - 8) panel.style.left = `${Math.max(8, Math.round(vw - 8 - width))}px`;
      }
      if (!viaPointer.current) panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      viaPointer.current = false;
    }

    panel.addEventListener("beforetoggle", onBeforeToggle);
    panel.addEventListener("toggle", onToggle);
    window.addEventListener("resize", close);
    return () => {
      panel.removeEventListener("beforetoggle", onBeforeToggle);
      panel.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", close);
    };
  }, [align, close]);

  return (
    <>
      {trigger({
        ref: triggerRef,
        popoverTarget: id,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": id,
        onPointerDown: () => {
          viaPointer.current = true;
        },
      })}
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[href], [data-popover-close]")) close();
        }}
        className={cn(
          "vayu-popover fixed inset-auto m-0 max-w-[calc(100vw-1rem)] rounded-2xl border border-vayu-border bg-vayu-elevated p-1.5 text-vayu-fg shadow-overlay",
          className,
        )}
      >
        {typeof children === "function" ? children(close) : children}
      </div>
    </>
  );
}
