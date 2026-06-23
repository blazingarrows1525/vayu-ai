import { appendMessage, getConversation, listMessages } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getConversation(id, ctx.workspaceId))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ messages: await listMessages(id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getConversation(id, ctx.workspaceId))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json()) as {
    role: string;
    content: string;
    provider?: string;
    model?: string;
    tokens?: number;
  };
  const row = await appendMessage(id, body.role, body.content, {
    provider: body.provider,
    model: body.model,
    tokens: body.tokens,
  });
  return Response.json(row, { status: 201 });
}
