import type { Metadata } from "next";
import { Notice } from "@/components/ui/feedback";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { listMembers } from "@/lib/data";
import { can } from "@/lib/rbac";
import { getActiveMembership, requireSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/workspace";
import { MembersManager } from "./members-manager";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const session = await requireSession();
  const membership = await getActiveMembership();
  if (!membership) {
    return (
      <PageContainer size="narrow">
        <PageHeader title="Members" />
        <Notice tone="warning" role="note" title="You're not in a workspace">
          Ask a workspace admin to invite you.
        </Notice>
      </PageContainer>
    );
  }
  const [members, workspaces] = await Promise.all([listMembers(membership.workspaceId), listUserWorkspaces(session.user.id)]);
  const workspaceName = workspaces.find((w) => w.id === membership.workspaceId)?.name ?? "this workspace";
  const canManage = can(membership.role, "workspace:manageMembers");

  return (
    <PageContainer size="narrow">
      <PageHeader
        eyebrow={workspaceName}
        title="Members"
        description={
          canManage
            ? "Invite people who already have a VAYU account, and choose what they can do here."
            : "Everyone with access to this workspace. Admins and owners manage membership."
        }
      />
      <MembersManager
        initial={members.map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role }))}
        currentUserId={session.user.id}
        actorRole={membership.role}
        workspaceName={workspaceName}
      />
    </PageContainer>
  );
}
