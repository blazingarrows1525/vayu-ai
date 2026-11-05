import { getMemberRole, removeMember, setMemberRole } from "@/lib/data";
import { canAssignRole, canManageMember, isAssignableRole } from "@/lib/rbac";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ userId: string }> };

/** Shared guard: the target must be a member ranked below the caller, and not the caller. */
async function authorize(userId: string) {
  const ctx = await checkPermission("workspace:manageMembers");
  if (!ctx.ok) return { error: Response.json({ error: "forbidden" }, { status: ctx.status }) };
  if (userId === ctx.userId) {
    return { error: Response.json({ reason: "self" }, { status: 403 }) };
  }
  const target = await getMemberRole(ctx.workspaceId, userId);
  if (!target) return { error: Response.json({ error: "not found" }, { status: 404 }) };
  if (!canManageMember(ctx.role, target)) {
    return { error: Response.json({ reason: "rank" }, { status: 403 }) };
  }
  return { ctx };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await params;
  const auth = await authorize(userId);
  if (auth.error) return auth.error;
  const body = (await req.json().catch(() => null)) as { role?: unknown } | null;
  if (!isAssignableRole(body?.role)) {
    return Response.json({ reason: "invalid_role" }, { status: 400 });
  }
  if (!canAssignRole(auth.ctx.role, body.role)) {
    return Response.json({ reason: "role_too_high" }, { status: 403 });
  }
  await setMemberRole(auth.ctx.workspaceId, userId, body.role);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await params;
  const auth = await authorize(userId);
  if (auth.error) return auth.error;
  await removeMember(auth.ctx.workspaceId, userId);
  return Response.json({ ok: true });
}
