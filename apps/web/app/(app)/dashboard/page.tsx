import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ChevronRight, FileText, Radio, Telescope } from "lucide-react";
import { NewDocumentButton } from "@/components/docs/new-document-button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { listDocuments, listMembers } from "@/lib/data";
import { plural, timeAgo } from "@/lib/format";
import { can, ROLE_LABEL } from "@/lib/rbac";
import { getActiveMembership, requireSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/workspace";
import { AiStatus } from "./ai-status";

export const metadata: Metadata = { title: "Home" };

const START = [
  { href: "/docs", icon: FileText, title: "Write a document", description: "Draft with Copilot, comment, keep history." },
  { href: "/research", icon: Telescope, title: "Ask your sources", description: "Add files or links, get answers with citations." },
  { href: "/agents", icon: Bot, title: "Run an agent", description: "Hand off a multi-step task and watch each step." },
  { href: "/live", icon: Radio, title: "Talk to VAYU", description: "A real-time voice and text conversation." },
] as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const membership = await getActiveMembership();
  const [workspaces, docs, members] = await Promise.all([
    listUserWorkspaces(session.user.id),
    membership ? listDocuments(membership.workspaceId) : Promise.resolve([]),
    membership ? listMembers(membership.workspaceId) : Promise.resolve([]),
  ]);
  const workspace = workspaces.find((w) => w.id === membership?.workspaceId);
  const firstName = session.user.name?.trim().split(/\s+/)[0];
  const canWrite = can(membership?.role, "document:write");
  const recent = docs.slice(0, 5);

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow={workspace?.name ?? "VAYU AI"}
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Pick up where you left off, or start something new."
        actions={canWrite ? <NewDocumentButton /> : undefined}
      />

      {!membership && (
        <Notice tone="warning" title="You're not in a workspace" role="note" className="mb-6">
          Ask a workspace admin to invite you, then sign in again.
        </Notice>
      )}

      <section aria-labelledby="start-title">
        <h2 id="start-title" className="sr-only">
          Start something
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {START.map(({ href, icon: Icon, title, description }) => (
            <li key={href}>
              <Link href={href} className="surface surface-interactive group flex h-full flex-col gap-3 rounded-2xl p-4">
                <span
                  aria-hidden
                  className="grid h-10 w-10 place-items-center rounded-xl border border-vayu-accent/25 bg-vayu-accent/10 text-vayu-accent"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-vayu-fg">
                    {title}
                    <ChevronRight
                      aria-hidden
                      className="h-4 w-4 text-vayu-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-vayu-accent"
                    />
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-vayu-muted">{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Panel
          id="recent"
          title="Recent documents"
          description={docs.length > 0 ? `${plural(docs.length, "document")} in this workspace` : undefined}
          actions={
            docs.length > 0 ? (
              <LinkButton href="/docs" size="sm" variant="ghost">
                All documents
              </LinkButton>
            ) : undefined
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              headingLevel={3}
              title="Nothing written yet"
              description={canWrite ? "Your documents will show up here." : "Documents created in this workspace will show up here."}
              action={canWrite ? <NewDocumentButton variant="secondary" /> : undefined}
              className="py-8"
            />
          ) : (
            <ul className="-mx-2 flex flex-col">
              {recent.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/docs/${d.id}`}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-vayu-fg/[0.04]"
                  >
                    <FileText aria-hidden className="h-4 w-4 shrink-0 text-vayu-subtle group-hover:text-vayu-accent" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-vayu-fg">{d.title || "Untitled"}</span>
                    <time dateTime={new Date(d.updatedAt).toISOString()} className="shrink-0 text-xs text-vayu-subtle">
                      {timeAgo(d.updatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          {workspace && (
            <Panel id="workspace" title="This workspace" headingLevel={2}>
              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-vayu-muted">Name</dt>
                  <dd className="truncate font-medium text-vayu-fg">{workspace.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-vayu-muted">Your role</dt>
                  <dd>
                    <Badge tone="accent">{ROLE_LABEL[workspace.role]}</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-vayu-muted">Members</dt>
                  <dd className="font-medium tabular-nums text-vayu-fg">{members.length}</dd>
                </div>
              </dl>
              <LinkButton href="/settings/members" size="sm" variant="secondary" className="mt-4">
                {can(workspace.role, "workspace:manageMembers") ? "Manage members" : "See members"}
              </LinkButton>
            </Panel>
          )}
          <Panel id="ai" title="AI service">
            <AiStatus />
          </Panel>
        </div>
      </div>

      <Disclosure summary="Technical details" className="mt-8">
        <p className="text-vayu-muted">Useful when reporting a problem.</p>
        <dl className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-[10rem_1fr]">
          <dt className="text-vayu-muted">User ID</dt>
          <dd className="break-all text-vayu-fg">{session.user.id}</dd>
          <dt className="text-vayu-muted">Workspace ID</dt>
          <dd className="break-all text-vayu-fg">{membership?.workspaceId ?? "—"}</dd>
          <dt className="text-vayu-muted">Role</dt>
          <dd className="text-vayu-fg">{membership?.role ?? "—"}</dd>
        </dl>
      </Disclosure>
    </PageContainer>
  );
}
