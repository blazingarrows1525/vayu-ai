import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Secondary detail that most people don't need (technical diagnostics, raw payloads). Native
 * <details>, so it works without JavaScript and is keyboard- and screen-reader-operable.
 */
export function Disclosure({
  summary,
  defaultOpen,
  className,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn("group rounded-xl border border-vayu-border bg-vayu-inset/60", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-vayu-fg transition-colors hover:text-vayu-accent [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 text-vayu-muted transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-vayu-border px-4 py-3 text-sm leading-relaxed">{children}</div>
    </details>
  );
}
