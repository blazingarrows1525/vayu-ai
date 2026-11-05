import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { getActiveMembership } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listDocuments } from "@/lib/data";
import { plural, timeAgo } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { NewDocumentButton } from "@/components/docs/new-document-button";

export const metadata: Metadata = { title: "Documents" };

export default async function DocsPage() {
  // The (app) layout has already validated the session.
  const membership = await getActiveMembership();

  if (!membership) {
    return (
      <PageContainer size="narrow">
        <PageHeader title="Documents" />
        <Notice tone="warning" title="You're not in a workspace" role="note">
          Documents live inside a workspace. Ask a workspace admin to invite you, then sign in again.
        </Notice>
      </PageContainer>
    );
  }

  const canWrite = can(membership.role, "document:write");
  const docs = await listDocuments(membership.workspaceId);
  const now = Date.now();

  return (
    <PageContainer size="narrow">
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        description={
          docs.length > 0
            ? `${plural(docs.length, "document")}, most recently edited first. Each one keeps its comments and version history.`
            : "Everything your workspace writes. Each document keeps its comments and version history."
        }
        // An empty workspace gets one call to action, in the empty state below.
        actions={canWrite ? docs.length > 0 && <NewDocumentButton /> : <Badge>View only</Badge>}
      />

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No documents yet"
          description={
            canWrite
              ? "Create the first one. You can comment on it and save snapshots to compare or restore later."
              : "Nothing has been written in this workspace yet. Editors and admins can create documents."
          }
          action={canWrite ? <NewDocumentButton /> : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/docs/${d.id}`}
                className="surface surface-interactive group flex items-center gap-3.5 rounded-xl px-4 py-3.5"
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-vayu-border bg-vayu-inset text-vayu-muted transition-colors group-hover:text-vayu-accent"
                >
                  {d.icon ? <span className="text-base leading-none">{d.icon}</span> : <FileText className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-vayu-fg">{d.title || "Untitled"}</span>
                  <span className="mt-0.5 block text-xs text-vayu-muted">
                    Edited <time dateTime={new Date(d.updatedAt).toISOString()}>{timeAgo(d.updatedAt, now)}</time>
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-vayu-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-vayu-accent"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
