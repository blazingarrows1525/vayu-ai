"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "./icon-button";
import { Button } from "./button";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is unavailable on insecure origins and in some embedded browsers.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Copies text and confirms it in place and to screen readers. `withText` shows a labelled button. */
export function CopyButton({
  value,
  label = "Copy",
  withText,
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  withText?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    const ok = await writeClipboard(value);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const current = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : label;
  const icon = state === "copied" ? <Check className="h-full w-full" /> : <Copy className="h-full w-full" />;

  return (
    <>
      {withText ? (
        <Button size={size} variant="ghost" icon={<span className="h-4 w-4" aria-hidden>{icon}</span>} onClick={copy} className={className}>
          {current}
        </Button>
      ) : (
        <IconButton label={current} icon={icon} size={size} onClick={copy} className={className} />
      )}
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn't copy to the clipboard" : ""}
      </span>
    </>
  );
}
