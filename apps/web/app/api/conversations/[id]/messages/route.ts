import { appendMessage, getConversation, listMessages } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const ROLES = new Set(["user", "assistant"]);

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getConversation(id, ctx.workspaceId, ctx.userId))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ messages: await listMessages(id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getConversation(id, ctx.workspaceId, ctx.userId))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as {
    role?: unknown;
    content?: unknown;
    provider?: unknown;
    model?: unknown;
    tokens?: unknown;
  } | null;
  if (typeof body?.role !== "string" || !ROLES.has(body.role)) {
    return Response.json({ error: "role must be user or assistant" }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }
  const row = await appendMessage(id, body.role, body.content, {
    provider: typeof body.provider === "string" ? body.provider : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    tokens: typeof body.tokens === "number" ? body.tokens : undefined,
  });
  return Response.json(row, { status: 201 });
}
