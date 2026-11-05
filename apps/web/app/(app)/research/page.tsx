import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { can } from "@/lib/rbac";
import { getActiveMembership } from "@/lib/session";
import { ResearchCenter } from "./research-center";

export const metadata: Metadata = { title: "Research" };

export default async function ResearchPage() {
  const membership = await getActiveMembership();
  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Intelligence"
        title="Research"
        description="Add files or web pages, then ask questions. Answers cite the passages they're based on."
      />
      <ResearchCenter canWrite={can(membership?.role, "document:write")} />
    </PageContainer>
  );
}
