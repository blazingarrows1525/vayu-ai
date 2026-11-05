import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDocument } from "@/lib/data";
import { can } from "@/lib/rbac";
import { getActiveMembership } from "@/lib/session";
import { DocumentWorkspace } from "./document-workspace";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The document in the caller's current workspace, or null (also for malformed ids). */
const load = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  const membership = await getActiveMembership();
  if (!membership) return null;
  const doc = await getDocument(id, membership.workspaceId);
  if (!doc || doc.isArchived) return null;
  return { doc, role: membership.role };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).id);
  return { title: found ? found.doc.title || "Untitled" : "Document not found" };
}

export default async function DocumentPage({ params }: Props) {
  const found = await load((await params).id);
  if (!found) notFound();
  const { doc, role } = found;

  return (
    <DocumentWorkspace
      doc={{
        id: doc.id,
        title: doc.title,
        content: doc.content as object | null,
        updatedAt: doc.updatedAt.toISOString(),
      }}
      canWrite={can(role, "document:write")}
    />
  );
}
