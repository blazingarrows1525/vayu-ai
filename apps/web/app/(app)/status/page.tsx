import type { Metadata } from "next";
import { StatusBoard } from "@/components/status-board";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { can } from "@/lib/rbac";
import { getActiveMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Service status" };

export default async function StatusPage() {
  const membership = await getActiveMembership();
  return (
    <PageContainer size="narrow">
      <PageHeader
        eyebrow="Insights"
        title="Service status"
        description="Checks, in order, every piece the AI features depend on, and says what to change when one isn't working."
      />
      <StatusBoard canFix={can(membership?.role, "workspace:updateSettings")} />
    </PageContainer>
  );
}
