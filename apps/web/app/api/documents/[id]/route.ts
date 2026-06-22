import { getDocument, updateDocument } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  const doc = await getDocument(id, ctx.workspaceId);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(doc);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: Record<string, unknown>;
    contentText?: string;
  };
  await updateDocument(id, ctx.workspaceId, body);
  return Response.json({ ok: true });
}
