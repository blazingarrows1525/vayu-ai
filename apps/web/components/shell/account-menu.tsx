"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, LogOut, Users } from "lucide-react";
import type { Role } from "@vayu/db";
import { Badge } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/lib/auth-client";
import { ROLE_LABEL } from "@/lib/rbac";

export type ShellUser = { name: string; email: string; image: string | null };

function initials(user: ShellUser) {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ITEM =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-vayu-fg transition-colors hover:bg-vayu-fg/[0.06] disabled:cursor-wait disabled:opacity-70";

/** Who you're signed in as, your role here, and the account-level destinations. */
export function AccountMenu({ user, role }: { user: ShellUser; role: Role | null }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // A full load (not a client navigation) drops every page the router cached for this
      // account. Even if the request failed, leave: /login re-checks the session.
      window.location.assign("/login");
    }
  }

  return (
    <Popover
      label="Account"
      align="end"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Account: ${user.name || user.email}`}
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-vayu-border-strong/50 bg-vayu-surface text-xs font-semibold text-vayu-fg transition-colors hover:border-vayu-accent/70 pointer-coarse:h-10 pointer-coarse:w-10"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- provider avatars come from arbitrary hosts
            <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{initials(user)}</span>
          )}
        </button>
      )}
    >
      <div className="w-[min(16.5rem,calc(100vw-2rem))]">
        <div className="px-3 pb-2.5 pt-2">
          <p className="truncate text-sm font-semibold text-vayu-fg">{user.name || "Signed in"}</p>
          <p className="truncate text-xs text-vayu-muted">{user.email}</p>
          {role && (
            <Badge tone="accent" className="mt-2">
              {ROLE_LABEL[role]} in this workspace
            </Badge>
          )}
        </div>
        <div className="border-t border-vayu-border py-1">
          <Link href="/settings/members" className={ITEM}>
            <Users aria-hidden className="h-4 w-4 text-vayu-muted" />
            Members
          </Link>
          <Link href="/status" className={ITEM}>
            <Activity aria-hidden className="h-4 w-4 text-vayu-muted" />
            Service status
          </Link>
        </div>
        <div className="border-t border-vayu-border pt-1">
          <button type="button" onClick={handleSignOut} disabled={signingOut} className={ITEM}>
            {signingOut ? <Spinner /> : <LogOut aria-hidden className="h-4 w-4 text-vayu-muted" />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </Popover>
  );
}
