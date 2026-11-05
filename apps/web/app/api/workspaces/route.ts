import { getActiveMembership, getSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/workspace";

/** The caller's workspaces, with the one this session acts within marked `active`. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [workspaces, active] = await Promise.all([listUserWorkspaces(session.user.id), getActiveMembership()]);
  return Response.json({
    workspaces: workspaces.map((w) => ({ ...w, active: w.id === active?.workspaceId })),
  });
}
