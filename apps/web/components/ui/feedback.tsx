import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type NoticeTone = "info" | "success" | "warning" | "danger";

const NOTICE: Record<NoticeTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-vayu-accent/30 bg-vayu-accent/[0.07]", icon: "text-vayu-accent", Icon: Info },
  success: { box: "border-vayu-success/35 bg-vayu-success/[0.07]", icon: "text-vayu-success", Icon: CircleCheck },
  warning: { box: "border-vayu-warning/40 bg-vayu-warning/[0.08]", icon: "text-vayu-warning", Icon: TriangleAlert },
  danger: { box: "border-vayu-danger/40 bg-vayu-danger/[0.07]", icon: "text-vayu-danger", Icon: CircleAlert },
};

/**
 * Inline message about the state of a page or action. Danger notices are announced immediately
 * (role="alert"); the others politely (role="status"). Pass `role="note"` for static guidance that
 * is part of the page rather than a reaction to something the user did.
 */
export function Notice({
  tone = "info",
  title,
  action,
  role,
  className,
  children,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status" | "note";
  className?: string;
  children?: ReactNode;
}) {
  const { box, icon, Icon } = NOTICE[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-vayu-fg", box, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? "mt-0.5" : undefined, "text-vayu-fg/85")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** What to show when a list or workspace area has nothing in it yet, and how to fill it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-dashed border-vayu-border-strong/45 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-2xl border border-vayu-accent/25 bg-vayu-accent/10 text-vayu-accent [&>svg]:h-5 [&>svg]:w-5"
        >
          {icon}
        </span>
      )}
      <div>
        <Heading className="text-section font-semibold text-vayu-fg">{title}</Heading>
        {description && <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-vayu-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Placeholder block shaped like the content that is loading. Decorative; pair with <Loading srOnly>. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/** Announces that an area is loading. `srOnly` keeps it for screen readers when skeletons show it visually. */
export function Loading({
  label = "Loading…",
  srOnly,
  className,
}: {
  label?: string;
  srOnly?: boolean;
  className?: string;
}) {
  if (srOnly) {
    return (
      <span role="status" className="sr-only">
        {label}
      </span>
    );
  }
  return (
    <div role="status" className={cn("flex items-center gap-2.5 text-sm text-vayu-muted", className)}>
      <Spinner />
      {label}
    </div>
  );
}
