import { type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-xl border border-vayu-border-strong bg-vayu-inset text-sm text-vayu-fg placeholder:text-vayu-subtle " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-vayu-accent focus:outline-none focus:ring-3 focus:ring-vayu-accent/25 " +
  "aria-[invalid=true]:border-vayu-danger aria-[invalid=true]:focus:ring-vayu-danger/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-vayu-surface";

export function controlClass(className?: string) {
  return cn(CONTROL, className);
}

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

/**
 * Label + optional description + inline error for one form control. Pass a render function to
 * receive the wiring (`id`, `aria-describedby`, `aria-invalid`) for the control.
 */
export function Field({
  id,
  label,
  description,
  error,
  required,
  hideLabel,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Keep the label for assistive tech but don't show it (e.g. a search field with an icon). */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode | ((props: FieldControlProps) => ReactNode);
}) {
  const descId = description ? `${id}-description` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const props: FieldControlProps = {
    id,
    "aria-describedby": [descId, errId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
    required,
  };
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium text-vayu-fg", hideLabel && "sr-only")}>
        {label}
        {required && (
          <span className="text-vayu-muted" aria-hidden>
            {" "}
            (required)
          </span>
        )}
      </label>
      {description && (
        <p id={descId} className="text-xs leading-relaxed text-vayu-muted">
          {description}
        </p>
      )}
      {typeof children === "function" ? children(props) : children}
      {error && (
        <p id={errId} role="alert" className="text-xs font-medium text-vayu-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={controlClass(cn("h-10 px-3 pointer-coarse:h-11", className))} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={controlClass(cn("min-h-24 resize-y px-3 py-2.5 leading-relaxed", className))} {...props} />;
}

export function Select({
  className,
  ref,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className={controlClass(cn("h-10 cursor-pointer pl-3 pr-8 pointer-coarse:h-11", className))} {...props}>
      {children}
    </select>
  );
}
