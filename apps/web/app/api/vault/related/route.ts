import { callAI } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

export async function GET(req: Request) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const sourceId = new URL(req.url).searchParams.get("sourceId");
  if (!sourceId) return Response.json({ related: [] });

  const res = await callAI(
    `/v1/knowledge/${encodeURIComponent(sourceId)}/related`,
    { method: "GET" },
  );
  const data = await res.json().catch(() => ({ related: [] }));
  return Response.json(data, { status: res.ok ? 200 : 502 });
}
