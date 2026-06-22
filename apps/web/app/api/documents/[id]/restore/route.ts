import { restoreVersion } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  const { version } = (await req.json()) as { version: number };
  const result = await restoreVersion(id, ctx.workspaceId, Number(version));
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(result);
}
