"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { sectionFor } from "@/lib/nav";
import { AccountMenu, type ShellUser } from "./account-menu";
import { BrandMark } from "./brand-mark";
import { type ShellWorkspace, WorkspaceSwitcher } from "./workspace-switcher";

/**
 * Top bar of the signed-in app: where you are (workspace / module), the theme, and your account.
 * Live is a full-screen console with its own header, so it keeps only the module navigation.
 */
export function AppHeader({
  user,
  workspaces,
  active,
}: {
  user: ShellUser;
  workspaces: ShellWorkspace[];
  active: ShellWorkspace | null;
}) {
  const pathname = usePathname();
  if (pathname === "/live" || pathname?.startsWith("/live/")) return null;
  const section = sectionFor(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-vayu-border/70 bg-vayu-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-3 sm:gap-2 sm:px-6">
        <Link href="/dashboard" aria-label="VAYU AI home" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg">
          <BrandMark className="h-7 w-7 text-vayu-accent" />
        </Link>
        <span aria-hidden className="text-vayu-border-strong/70">
          /
        </span>
        <WorkspaceSwitcher workspaces={workspaces} active={active} />
        {section && (
          <>
            <span aria-hidden className="hidden text-vayu-border-strong/70 sm:inline">
              /
            </span>
            <span className="hidden truncate text-sm font-medium text-vayu-muted sm:inline">{section.label}</span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <AccountMenu user={user} role={active?.role ?? null} />
        </div>
      </div>
    </header>
  );
}
