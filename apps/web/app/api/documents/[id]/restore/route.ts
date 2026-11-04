import { restoreVersion } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { version?: unknown } | null;
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) {
    return Response.json({ error: "version must be a positive integer" }, { status: 400 });
  }
  const result = await restoreVersion(id, ctx.workspaceId, ctx.userId, version);
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(result);
}
