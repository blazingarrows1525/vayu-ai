"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, X } from "lucide-react";
import { IconButton, Tooltip } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { isActivePath, MEMBERS_ITEM, MOBILE_PRIMARY, NAV_GROUPS, type NavItem, navItem } from "@/lib/nav";

/** Desktop: a grouped dock with labels on hover and focus. Phones: four pinned tabs plus "More". */
export function AppNav() {
  const pathname = usePathname();
  return (
    <>
      <Dock pathname={pathname} />
      <TabBar pathname={pathname} />
    </>
  );
}

function Dock({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Modules" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 hidden justify-center md:flex">
      <div className="glass pointer-events-auto flex items-center rounded-2xl p-1.5 shadow-ambient">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="flex items-center">
            {gi > 0 && <span aria-hidden className="mx-1.5 h-6 w-px bg-vayu-border-strong/35" />}
            <ul aria-label={group.label} className="flex items-center gap-1">
              {group.items.map((item) => (
                <DockLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function DockLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li className="group/tip relative">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "grid h-11 w-11 place-items-center rounded-xl transition-[background-color,color,transform] duration-150 ease-standard",
          "hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:hover:translate-y-0",
          active
            ? "bg-vayu-accent/15 text-vayu-accent"
            : "text-vayu-muted hover:bg-vayu-fg/[0.07] hover:text-vayu-fg",
        )}
      >
        <Icon aria-hidden className="h-[19px] w-[19px]" strokeWidth={1.8} />
        <span className="sr-only">{item.label}</span>
      </Link>
      {active && (
        <span aria-hidden className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-vayu-accent" />
      )}
      <Tooltip label={item.label} />
    </li>
  );
}

function TabBar({ pathname }: { pathname: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pinned = MOBILE_PRIMARY.map(navItem);
  const inMore = !pinned.some((item) => isActivePath(pathname, item.href)) && pathname !== null;

  return (
    <>
      <nav
        aria-label="Modules"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-vayu-border bg-vayu-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {pinned.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-vayu-accent" : "text-vayu-muted hover:text-vayu-fg",
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-vayu-accent" />}
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.8} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                inMore ? "text-vayu-accent" : "text-vayu-muted hover:text-vayu-fg",
              )}
            >
              {inMore && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-vayu-accent" />}
              <Ellipsis aria-hidden className="h-5 w-5" strokeWidth={1.8} />
              More
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </>
  );
}

/** Every module, grouped, in a bottom sheet (native modal <dialog>: focus trap, Escape, inert page). */
function MoreSheet({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const groups = [
    ...NAV_GROUPS.slice(0, -1),
    { ...NAV_GROUPS[NAV_GROUPS.length - 1]!, items: [...NAV_GROUPS[NAV_GROUPS.length - 1]!.items, MEMBERS_ITEM] },
  ];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // A link inside navigates client-side; close the sheet once the route changes.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on navigation
  }, [pathname]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="more-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="vayu-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-t border-vayu-border bg-vayu-elevated p-0 text-vayu-fg md:hidden"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id="more-sheet-title" className="text-section font-semibold">
            All modules
          </h2>
          <IconButton label="Close" icon={<X className="h-full w-full" />} size="sm" onClick={onClose} tooltipSide="bottom" />
        </div>
        <nav aria-label="All modules" className="overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {groups.map((group) => (
            <div key={group.label} className="pt-2">
              <p className="px-2 pb-1 text-overline font-semibold uppercase text-vayu-muted">{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors",
                          active ? "bg-vayu-accent/10" : "hover:bg-vayu-fg/[0.05]",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                            active
                              ? "border-vayu-accent/40 bg-vayu-accent/15 text-vayu-accent"
                              : "border-vayu-border bg-vayu-inset text-vayu-muted",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0">
                          <span className={cn("block text-sm font-medium", active ? "text-vayu-accent" : "text-vayu-fg")}>
                            {item.label}
                          </span>
                          <span className="block truncate text-xs text-vayu-muted">{item.description}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </dialog>
  );
}
