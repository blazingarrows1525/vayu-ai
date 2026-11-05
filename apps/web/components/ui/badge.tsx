import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "accent" | "violet" | "success" | "warning" | "danger";

const BADGE: Record<Tone, string> = {
  neutral: "border-vayu-border-strong/45 bg-vayu-fg/[0.04] text-vayu-muted",
  accent: "border-vayu-accent/40 bg-vayu-accent/10 text-vayu-accent",
  violet: "border-vayu-violet/40 bg-vayu-violet/10 text-vayu-violet",
  success: "border-vayu-success/40 bg-vayu-success/10 text-vayu-success",
  warning: "border-vayu-warning/45 bg-vayu-warning/10 text-vayu-warning",
  danger: "border-vayu-danger/40 bg-vayu-danger/10 text-vayu-danger",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-vayu-subtle",
  accent: "bg-vayu-accent",
  violet: "bg-vayu-violet",
  success: "bg-vayu-success",
  warning: "bg-vayu-warning",
  danger: "bg-vayu-danger",
};

/** Compact label for a state or category. The text carries the meaning; colour only reinforces it. */
export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-5",
        BADGE[tone],
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="grid h-3.5 w-3.5 place-items-center [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

/** A status light next to its text label (never a bare colour). `pulse` is for "in progress" only. */
export function StatusDot({
  tone = "neutral",
  label,
  pulse,
  className,
}: {
  tone?: Tone;
  label: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium text-vayu-muted", className)}>
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone], pulse && "animate-blink-soft")} />
      {label}
    </span>
  );
}
