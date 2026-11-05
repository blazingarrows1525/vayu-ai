import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { getActiveMembership } from "@/lib/session";
import { VaultSearch } from "./vault-search";

export const metadata: Metadata = { title: "Vault" };

export default async function VaultPage() {
  const membership = await getActiveMembership();
  return (
    <PageContainer size="narrow">
      <PageHeader
        eyebrow="Intelligence"
        title="Vault"
        description="Search everything you've added in Research by meaning, not just keywords, and find sources that relate to each other."
      />
      <VaultSearch workspaceId={membership?.workspaceId ?? "none"} />
    </PageContainer>
  );
}
