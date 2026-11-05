"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Confirmation for consequential actions, on the native modal <dialog>: the browser traps focus,
 * closes on Escape and makes the rest of the page inert. Cancel gets initial focus, so pressing
 * Enter by reflex never confirms. While `pending`, it can't be dismissed.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Escape: let the parent decide (it owns `open`), and never close mid-action.
        e.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(e) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      className="vayu-dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-vayu-border bg-vayu-elevated p-0 text-vayu-fg shadow-overlay"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-section font-semibold">
          {title}
        </h2>
        {description && (
          <div id={descId} className="mt-2 text-sm leading-relaxed text-vayu-muted">
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending} loadingLabel={pendingLabel}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
