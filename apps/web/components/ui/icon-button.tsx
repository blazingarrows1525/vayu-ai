import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

type Side = "top" | "bottom";

const TIP_SIDE: Record<Side, string> = {
  top: "bottom-full mb-2",
  bottom: "top-full mt-2",
};

/** Visual label shown on hover and on keyboard focus (never the only source of the name). */
export function Tooltip({ label, side = "top" }: { label: ReactNode; side?: Side }) {
  return (
    <span
      aria-hidden
      className={cn(
        "glass pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1",
        "text-[11px] font-medium text-vayu-fg opacity-0 shadow-overlay transition-opacity duration-150",
        "group-hover/tip:opacity-100 group-hover/tip:delay-300 group-focus-within/tip:opacity-100",
        TIP_SIDE[side],
      )}
    >
      {label}
    </span>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Accessible name and tooltip text — required, icon-only controls need one. */
  label: string;
  icon: ReactNode;
  tooltipSide?: Side;
  /** For toggles: exposes aria-pressed and the selected styling. */
  pressed?: boolean;
  size?: "sm" | "md";
  ref?: Ref<HTMLButtonElement>;
};

export function IconButton({
  label,
  icon,
  tooltipSide = "top",
  pressed,
  size = "md",
  className,
  type = "button",
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-xl border transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
          size === "md" ? "h-10 w-10 pointer-coarse:h-11 pointer-coarse:w-11" : "h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10",
          pressed
            ? "border-vayu-accent/60 bg-vayu-accent/15 text-vayu-accent"
            : "border-vayu-border bg-vayu-surface/60 text-vayu-muted hover:border-vayu-accent/50 hover:text-vayu-fg",
          className,
        )}
        {...rest}
      >
        <span className={cn("grid place-items-center", size === "md" ? "h-[18px] w-[18px]" : "h-4 w-4")} aria-hidden>
          {icon}
        </span>
      </button>
      <Tooltip label={label} side={tooltipSide} />
    </span>
  );
}
