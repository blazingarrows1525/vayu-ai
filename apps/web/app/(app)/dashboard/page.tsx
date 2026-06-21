import { getActiveMembership, requireSession } from "@/lib/session";
import { AiPing } from "./ai-ping";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const session = await requireSession();
  const membership = await getActiveMembership();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Command center</h1>
        </div>
        <SignOutButton />
      </header>

      <section className="mt-10 grid gap-4">
        <Card title="Identity">
          <Row label="Name" value={session.user.name} />
          <Row label="Email" value={session.user.email} />
          <Row label="User ID" value={session.user.id} mono />
        </Card>

        <Card title="Active workspace (RBAC)">
          <Row label="Workspace ID" value={membership?.workspaceId ?? "—"} mono />
          <Row label="Your role" value={membership?.role ?? "—"} />
        </Card>

        <Card title="Intelligence-plane bridge">
          <p className="mb-3 text-sm text-vayu-muted">
            Calls <code>/api/ai/agents</code> — the BFF mints a JWT, the FastAPI
            plane verifies it via JWKS and returns the agent catalog.
          </p>
          <AiPing />
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
      <h2 className="text-sm font-semibold text-vayu-fg">{title}</h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-vayu-muted">{label}</span>
      <span className={mono ? "font-mono text-xs text-vayu-fg" : "text-vayu-fg"}>
        {value}
      </span>
    </div>
  );
}
