import { AppHeader } from "@/components/shell/app-header";
import { AppNav } from "@/components/shell/app-nav";
import { getActiveMembership, requireSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/workspace";

/**
 * Shell for every signed-in route. The session is validated here, on the server, once per
 * request (the proxy only checks that a cookie exists). Pages render inside <main id="main">.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [workspaces, membership] = await Promise.all([listUserWorkspaces(session.user.id), getActiveMembership()]);
  const active = workspaces.find((w) => w.id === membership?.workspaceId) ?? null;

  return (
    <div data-app-shell className="relative min-h-dvh">
      <AppHeader
        user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
        workspaces={workspaces}
        active={active}
      />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <AppNav />
    </div>
  );
}
