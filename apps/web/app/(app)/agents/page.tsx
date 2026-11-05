import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { can } from "@/lib/rbac";
import { getActiveMembership } from "@/lib/session";
import { AgentsConsole } from "./agents-console";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const membership = await getActiveMembership();
  return (
    <PageContainer size="default">
      <PageHeader
        eyebrow="Intelligence"
        title="Agents"
        description="Hand a task to an agent. It plans, uses tools when it needs them, and reports each step as it works."
      />
      <AgentsConsole canRun={can(membership?.role, "document:write")} />
    </PageContainer>
  );
}
