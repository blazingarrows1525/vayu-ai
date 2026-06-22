import type { Role } from "@vayu/db";
import { inviteMember, listMembers } from "@/lib/data";
import { checkPermission } from "@/lib/session";

export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  return Response.json({ members: await listMembers(ctx.workspaceId) });
}

export async function POST(req: Request) {
  const ctx = await checkPermission("workspace:manageMembers");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { email, role } = (await req.json()) as { email: string; role?: Role };
  const result = await inviteMember(
    ctx.workspaceId,
    email,
    role ?? "viewer",
    ctx.userId,
  );
  return Response.json(result, { status: result.ok ? 201 : 400 });
}
