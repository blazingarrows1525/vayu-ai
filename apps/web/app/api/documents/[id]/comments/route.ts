import {
  createComment,
  filterMemberIds,
  getDocument,
  listComments,
  setCommentResolved,
} from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = () => Response.json({ error: "not found" }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getDocument(id, ctx.workspaceId))) return NOT_FOUND();
  return Response.json({ comments: await listComments(id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getDocument(id, ctx.workspaceId))) return NOT_FOUND();

  const body = (await req.json().catch(() => null)) as {
    body?: unknown;
    blockId?: unknown;
    mentions?: unknown;
  } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return Response.json({ error: "Write a comment first." }, { status: 400 });
  if (text.length > 5000) {
    return Response.json({ error: "Comments are limited to 5,000 characters." }, { status: 400 });
  }
  const requested = Array.isArray(body?.mentions)
    ? body.mentions.filter((m): m is string => typeof m === "string").slice(0, 20)
    : [];
  const row = await createComment(
    id,
    ctx.userId,
    text,
    typeof body?.blockId === "string" ? body.blockId : null,
    await filterMemberIds(ctx.workspaceId, requested),
  );
  return Response.json(row, { status: 201 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  const { id } = await params;
  if (!(await getDocument(id, ctx.workspaceId))) return NOT_FOUND();
  const body = (await req.json().catch(() => null)) as {
    commentId?: unknown;
    resolved?: unknown;
  } | null;
  if (typeof body?.commentId !== "string") {
    return Response.json({ error: "commentId is required" }, { status: 400 });
  }
  const updated = await setCommentResolved(body.commentId, id, Boolean(body.resolved));
  if (!updated) return NOT_FOUND();
  return Response.json({ ok: true });
}
