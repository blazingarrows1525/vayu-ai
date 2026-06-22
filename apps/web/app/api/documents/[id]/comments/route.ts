import { createComment, listComments, setCommentResolved } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  return Response.json({ comments: await listComments(id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  const body = (await req.json()) as {
    body: string;
    blockId?: string;
    mentions?: string[];
  };
  const row = await createComment(
    id,
    ctx.userId,
    body.body,
    body.blockId ?? null,
    body.mentions ?? [],
  );
  return Response.json(row, { status: 201 });
}

export async function PATCH(req: Request, _ctx: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { commentId, resolved } = (await req.json()) as {
    commentId: string;
    resolved: boolean;
  };
  await setCommentResolved(commentId, Boolean(resolved));
  return Response.json({ ok: true });
}
