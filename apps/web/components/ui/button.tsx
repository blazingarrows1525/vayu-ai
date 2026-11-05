import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-standard " +
  "active:scale-[0.97] motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  // The page's single most important action.
  primary:
    "bg-vayu-accent text-vayu-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_-14px_var(--glow-accent)] " +
    "hover:bg-[color-mix(in_oklab,var(--color-vayu-accent)_86%,var(--color-vayu-fg))] " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_-12px_var(--glow-accent)]",
  // Supporting actions.
  secondary:
    "border border-vayu-border-strong/55 bg-vayu-surface text-vayu-fg shadow-card " +
    "hover:border-vayu-accent/70 hover:text-vayu-accent",
  // Toolbars and dense contexts.
  ghost: "text-vayu-muted hover:bg-vayu-fg/[0.07] hover:text-vayu-fg",
  // Consequential, irreversible actions (always behind a confirmation).
  danger:
    "bg-vayu-danger text-vayu-on-accent hover:bg-[color-mix(in_oklab,var(--color-vayu-danger)_86%,var(--color-vayu-fg))]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs pointer-coarse:min-h-10",
  md: "h-10 px-4 text-sm pointer-coarse:min-h-11",
  lg: "h-12 px-5 text-[0.95rem]",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  block,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  CommonProps & {
    /** Shows a spinner, disables the button and marks it busy (prevents double submission). */
    loading?: boolean;
    /** Label while loading, e.g. "Saving…" (defaults to the normal label). */
    loadingLabel?: ReactNode;
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({
  variant,
  size,
  block,
  icon,
  iconRight,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children != null && <span>{loading && loadingLabel ? loadingLabel : children}</span>}
      {!loading && iconRight}
    </button>
  );
}

/** A navigation link styled as a button (keeps link semantics: middle-click, open in new tab). */
export function LinkButton({
  variant,
  size,
  block,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & CommonProps) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...rest}>
      {icon}
      {children != null && <span>{children}</span>}
      {iconRight}
    </Link>
  );
}
