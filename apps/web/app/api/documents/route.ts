import { createDocument, listDocuments } from "@/lib/data";
import { checkPermission } from "@/lib/session";

export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  return Response.json({ documents: await listDocuments(ctx.workspaceId) });
}

export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const row = await createDocument(ctx.workspaceId, ctx.userId, title ?? "Untitled");
  return Response.json(row, { status: 201 });
}
