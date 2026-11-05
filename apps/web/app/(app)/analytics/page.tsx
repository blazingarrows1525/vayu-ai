import type { Metadata } from "next";
import { Panel } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { getAnalytics } from "@/lib/data";
import { formatUsd, plural } from "@/lib/format";
import { getActiveMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Analytics" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-vayu-border bg-vayu-inset/60 p-4">
      <dt className="text-xs font-medium text-vayu-muted">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-vayu-fg">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-vayu-subtle">{hint}</dd>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const membership = await getActiveMembership();
  if (!membership) {
    return (
      <PageContainer size="default">
        <PageHeader title="Analytics" />
        <Notice tone="warning" role="note" title="You're not in a workspace">
          Analytics are counted per workspace.
        </Notice>
      </PageContainer>
    );
  }
  const a = await getAnalytics(membership.workspaceId);

  return (
    <PageContainer size="default">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Counted from this workspace's documents and Copilot usage. Figures update when you load the page."
      />
      <div className="flex flex-col gap-6">
        <Panel id="writing" title="Writing" description="Across every document that isn't archived.">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Documents" value={a.documents.toLocaleString("en")} />
            <Stat label="Words in documents" value={a.words.toLocaleString("en")} />
            <Stat label="Reading time" value={`${a.readingMinutes.toLocaleString("en")} min`} hint="At 200 words a minute" />
            <Stat label="Edited in the last 7 days" value={plural(a.recentlyEdited, "document")} />
          </dl>
        </Panel>
        <Panel
          id="copilot"
          title="Copilot usage"
          description="Copilot runs from documents and the scratchpad, since the workspace started. Research, agents and voice aren't metered here yet."
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="Copilot runs" value={a.aiGenerations.toLocaleString("en")} />
            <Stat label="Tokens used" value={a.aiTokens.toLocaleString("en")} hint="Prompt and completion combined" />
            <Stat label="Estimated cost" value={formatUsd(a.aiCostUsd)} hint="Provider list prices; your bill may differ" />
          </dl>
        </Panel>
      </div>
    </PageContainer>
  );
}
