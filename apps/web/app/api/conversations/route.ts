import { createConversation, listConversations } from "@/lib/data";
import { checkPermission } from "@/lib/session";

export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  return Response.json({
    conversations: await listConversations(ctx.workspaceId, ctx.userId),
  });
}

export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { title, agentType } = (await req.json().catch(() => ({}))) as {
    title?: string;
    agentType?: string;
  };
  const row = await createConversation(ctx.workspaceId, ctx.userId, title, agentType);
  return Response.json(row, { status: 201 });
}
