import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const WIDTH = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
} as const;

/** Page column with consistent gutters; the bottom padding clears the fixed module navigation. */
export function PageContainer({
  size = "default",
  className,
  children,
}: {
  size?: keyof typeof WIDTH;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-8 pb-nav sm:px-6 sm:pt-10", WIDTH[size], className)}>{children}</div>
  );
}

/** The page's one h1, with an optional overline, a sentence of context and the primary actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="text-overline font-semibold uppercase text-vayu-accent">{eyebrow}</p>}
        <h1 className={cn("text-2xl font-semibold tracking-tight text-vayu-fg sm:text-page", eyebrow ? "mt-1.5" : undefined)}>
          {title}
        </h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-vayu-muted sm:text-[0.95rem]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
