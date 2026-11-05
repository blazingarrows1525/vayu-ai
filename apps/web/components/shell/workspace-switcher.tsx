"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import type { Role } from "@vayu/db";
import { Popover } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { sectionFor } from "@/lib/nav";
import { can, ROLE_LABEL } from "@/lib/rbac";

export type ShellWorkspace = { id: string; name: string; role: Role };

function WorkspaceAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md border border-vayu-accent/25 bg-vayu-accent/12 text-[11px] font-semibold uppercase text-vayu-accent",
        className,
      )}
    >
      {name.trim().charAt(0) || "W"}
    </span>
  );
}

/** Shows which workspace you're acting in and switches between the ones you belong to. */
export function WorkspaceSwitcher({ workspaces, active }: { workspaces: ShellWorkspace[]; active: ShellWorkspace | null }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!active) return <span className="truncate text-sm text-vayu-muted">No workspace</span>;
  const current = active;

  async function choose(id: string, close: () => void) {
    if (id === current.id) return close();
    setPending(id);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) {
        setError(
          res.status === 404
            ? "You're no longer a member of that workspace."
            : `Couldn't switch workspaces (error ${res.status}).`,
        );
        setPending(null);
        return;
      }
      close();
      // A full load, not a client navigation: every page's data changes with the workspace, and
      // the client router may hold pages rendered for the old one. Stay in the same module (a
      // document or run from the old workspace won't exist in the new one).
      window.location.assign(sectionFor(pathname)?.href ?? "/dashboard");
      return; // stay "pending" until the new page loads
    } catch {
      setError("Couldn't reach VAYU. Check your connection and try again.");
    }
    setPending(null);
  }

  return (
    <Popover
      label="Workspaces"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className="inline-flex h-9 min-w-0 max-w-[11rem] items-center gap-2 rounded-lg px-2 text-sm font-medium text-vayu-fg transition-colors hover:bg-vayu-fg/[0.06] sm:max-w-[17rem]"
        >
          <WorkspaceAvatar name={current.name} />
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-vayu-muted" />
          <span className="sr-only">(switch workspace)</span>
        </button>
      )}
    >
      {(close) => (
        <div className="w-[min(18rem,calc(100vw-2rem))]">
          <p className="px-2.5 pb-1.5 pt-1.5 text-overline font-semibold uppercase text-vayu-muted">Your workspaces</p>
          <ul>
            {workspaces.map((w) => {
              const isCurrent = w.id === current.id;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? "true" : undefined}
                    disabled={pending !== null}
                    onClick={() => choose(w.id, close)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-vayu-fg/[0.06] disabled:cursor-wait",
                      isCurrent && "bg-vayu-accent/[0.08]",
                    )}
                  >
                    <WorkspaceAvatar name={w.name} className="h-7 w-7 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-vayu-fg">{w.name}</span>
                      <span className="block text-xs text-vayu-muted">{ROLE_LABEL[w.role]}</span>
                    </span>
                    {pending === w.id ? (
                      <Spinner className="text-vayu-accent" />
                    ) : isCurrent ? (
                      <Check aria-hidden className="h-4 w-4 shrink-0 text-vayu-accent" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {workspaces.length === 1 && (
            <p className="px-2.5 pb-1 pt-1.5 text-xs leading-relaxed text-vayu-muted">
              Workspaces you&rsquo;re invited to appear here.
            </p>
          )}
          {error && (
            <p role="alert" className="px-2.5 py-1.5 text-xs font-medium text-vayu-danger">
              {error}
            </p>
          )}
          {can(current.role, "workspace:manageMembers") && (
            <div className="mt-1 border-t border-vayu-border pt-1">
              <Link
                href="/settings/members"
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-vayu-muted transition-colors hover:bg-vayu-fg/[0.06] hover:text-vayu-fg"
              >
                <Users aria-hidden className="h-4 w-4" />
                Manage members
              </Link>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
