import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Solid working surface. It stays still on hover; pass `interactive` only when the whole card is
 * a single control (a navigation link), which adds the lift and edge highlight.
 */
export function Card({
  interactive,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("surface rounded-2xl", interactive && "surface-interactive", className)} {...props} />;
}

/** A titled section of a page: heading, optional description and actions, then its content. */
export function Panel({
  title,
  description,
  actions,
  headingLevel = 2,
  id,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  /** Gives the section an accessible name (its heading) so it is listed as a region. */
  id?: string;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} className={cn("surface rounded-2xl p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Heading id={titleId} className="text-section font-semibold text-vayu-fg">
            {title}
          </Heading>
          {description && <p className="mt-1 text-sm leading-relaxed text-vayu-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children != null && <div className={cn("mt-4", bodyClassName)}>{children}</div>}
    </section>
  );
}
