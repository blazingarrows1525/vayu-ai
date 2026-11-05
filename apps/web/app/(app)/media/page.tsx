import type { Metadata } from "next";
import { VideoSummarizer } from "@/components/media/video-summarizer";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { can } from "@/lib/rbac";
import { getActiveMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const membership = await getActiveMembership();
  return (
    <PageContainer size="narrow">
      <PageHeader
        eyebrow="Voice & media"
        title="Media"
        description="Upload a short video and VAYU writes a summary of what happens in it. When the knowledge base is available, the summary is also added to this workspace's research sources."
      />
      <VideoSummarizer canSave={can(membership?.role, "document:write")} />
    </PageContainer>
  );
}
