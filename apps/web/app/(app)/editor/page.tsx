import type { Metadata } from "next";
import { can } from "@/lib/rbac";
import { getActiveMembership, requireSession } from "@/lib/session";
import { Scratchpad } from "./scratchpad";

export const metadata: Metadata = { title: "Scratchpad" };

export default async function ScratchpadPage() {
  const session = await requireSession();
  const membership = await getActiveMembership();
  return <Scratchpad userId={session.user.id} canWrite={can(membership?.role, "document:write")} />;
}
