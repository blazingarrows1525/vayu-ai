import { getAnalytics } from "@/lib/data";
import { checkPermission } from "@/lib/session";

export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });
  return Response.json(await getAnalytics(ctx.workspaceId));
}
