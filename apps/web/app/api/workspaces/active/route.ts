import { getSession } from "@/lib/session";
import { setSessionWorkspace } from "@/lib/workspace";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Switch the workspace this session acts within. Only workspaces the caller belongs to; any
 *  other id is a 404, so the endpoint can't be used to probe for workspace ids. */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { workspaceId?: unknown } | null;
  const workspaceId = body?.workspaceId;
  if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) {
    return Response.json({ error: "invalid_workspace" }, { status: 400 });
  }
  const workspace = await setSessionWorkspace(session.session.id, session.user.id, workspaceId);
  if (!workspace) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true, workspace });
}
