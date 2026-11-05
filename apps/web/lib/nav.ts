import type { Route } from "next";
import {
  Activity,
  Bot,
  ChartColumn,
  FileText,
  Film,
  LayoutGrid,
  Library,
  type LucideIcon,
  Mic,
  NotebookPen,
  Radio,
  Telescope,
  Users,
} from "lucide-react";

export type NavItem = { href: Route; label: string; description: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/** The product's modules, grouped. The desktop dock, the phone tab bar and its "More" sheet and
 *  the header's section label are all built from this one list. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Home", description: "Your workspace at a glance", icon: LayoutGrid },
      { href: "/docs", label: "Documents", description: "Write, comment and keep version history", icon: FileText },
      { href: "/editor", label: "Scratchpad", description: "Quick drafts with Copilot", icon: NotebookPen },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/research", label: "Research", description: "Ask questions answered from your sources", icon: Telescope },
      { href: "/agents", label: "Agents", description: "Run multi-step research and writing agents", icon: Bot },
      { href: "/vault", label: "Vault", description: "Search everything by meaning", icon: Library },
    ],
  },
  {
    label: "Voice & media",
    items: [
      { href: "/live", label: "Live", description: "Talk with VAYU in real time", icon: Radio },
      { href: "/voice", label: "Voice", description: "Ask by voice, hear the answer", icon: Mic },
      { href: "/media", label: "Media", description: "Summarise a video", icon: Film },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", description: "Writing and AI usage", icon: ChartColumn },
      { href: "/status", label: "Status", description: "Which services are working", icon: Activity },
    ],
  },
];

export const MEMBERS_ITEM: NavItem = {
  href: "/settings/members",
  label: "Members",
  description: "Invite people and set their roles",
  icon: Users,
};

/** Pinned to the phone tab bar; everything else is one tap away under "More". */
export const MOBILE_PRIMARY: Route[] = ["/dashboard", "/docs", "/research", "/live"];

const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), MEMBERS_ITEM];

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The module a path belongs to (for the header's section label and post-switch navigation). */
export function sectionFor(pathname: string | null): NavItem | undefined {
  return ALL_ITEMS.find((item) => isActivePath(pathname, item.href));
}

export function navItem(href: Route): NavItem {
  const item = ALL_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`unknown nav item ${href}`);
  return item;
}
