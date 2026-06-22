import type { Role } from "@vayu/db";
import { removeMember, setMemberRole } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("workspace:manageMembers");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { userId } = await params;
  const { role } = (await req.json()) as { role: Role };
  await setMemberRole(ctx.workspaceId, userId, role);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("workspace:manageMembers");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { userId } = await params;
  await removeMember(ctx.workspaceId, userId);
  return Response.json({ ok: true });
}
