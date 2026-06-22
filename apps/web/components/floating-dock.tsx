"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  accent?: "accent" | "violet";
};

const I = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  editor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  docs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3v5h5" />
      <path d="M5 3h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M8 13h8M8 17h6" />
    </svg>
  ),
  research: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  ),
  vault: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3 7l9 4 9-4-9-4Z" />
      <path d="m3 12 9 4 9-4M3 17l9 4 9-4" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: I.dashboard },
  { href: "/editor", label: "Editor", icon: I.editor },
  { href: "/docs", label: "Docs", icon: I.docs },
  { href: "/research", label: "Research", icon: I.research, accent: "violet" },
  { href: "/agents", label: "Agents", icon: I.agents, accent: "violet" },
  { href: "/vault", label: "Vault", icon: I.vault },
  { href: "/analytics", label: "Analytics", icon: I.analytics },
];

/** Floating macOS-style AI dock: glowing, floating icons that magnify on hover. */
export function FloatingDock() {
  const pathname = usePathname();
  const hideOn = ["/login", "/signup"];
  if (hideOn.some((p) => pathname?.startsWith(p))) return null;

  return (
    <nav
      aria-label="VAYU navigation"
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
    >
      <ul className="glass glow-soft flex items-end gap-1.5 rounded-2xl px-2.5 py-2">
        {ITEMS.map((item, i) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const ring =
            item.accent === "violet"
              ? "group-hover:shadow-[0_0_26px_-4px_var(--color-vayu-violet)] group-hover:text-vayu-violet"
              : "group-hover:shadow-[0_0_26px_-4px_var(--color-vayu-accent)] group-hover:text-vayu-accent";
          return (
            <li key={item.href} className="animate-float" style={{ animationDelay: `${i * 0.35}s` }}>
              <Link
                href={item.href as never}
                aria-label={item.label}
                className="group relative grid place-items-center"
              >
                {/* tooltip */}
                <span className="glass pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-vayu-fg opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                </span>
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl border transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:scale-110 ${ring} ${
                    active
                      ? "border-vayu-accent/60 bg-vayu-accent/15 text-vayu-accent"
                      : "border-vayu-border bg-vayu-bg/50 text-vayu-muted"
                  }`}
                >
                  <span className="h-5 w-5">{item.icon}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
