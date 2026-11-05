import { inviteMember, listMembers } from "@/lib/data";
import { canAssignRole, isAssignableRole } from "@/lib/rbac";
import { checkPermission } from "@/lib/session";

export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  return Response.json({ members: await listMembers(ctx.workspaceId) });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ctx = await checkPermission("workspace:manageMembers");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const body = (await req.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) {
    return Response.json({ ok: false, reason: "invalid_email" }, { status: 400 });
  }
  const role = body?.role ?? "viewer";
  if (!isAssignableRole(role)) {
    return Response.json({ ok: false, reason: "invalid_role" }, { status: 400 });
  }
  if (!canAssignRole(ctx.role, role)) {
    return Response.json({ ok: false, reason: "role_too_high" }, { status: 403 });
  }
  const result = await inviteMember(ctx.workspaceId, email, role, ctx.userId);
  return Response.json(result, { status: result.ok ? 201 : 400 });
}
