import { type DocumentPatch, getDocument, updateDocument } from "@/lib/data";
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
  const body = (await req.json().catch(() => null)) as DocumentPatch | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  // Only these fields are ever written, whatever else the body carries.
  const updated = await updateDocument(id, ctx.workspaceId, {
    title: body.title,
    content: body.content,
    contentText: body.contentText,
  });
  if (!updated) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
