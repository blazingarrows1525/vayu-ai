import { createVersion, listVersions } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  return Response.json({ versions: await listVersions(id) });
}

export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  const row = await createVersion(id, ctx.workspaceId, ctx.userId);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(row, { status: 201 });
}
