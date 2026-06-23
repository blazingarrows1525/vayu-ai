import { callAI } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const body = await req.json();
  const res = await callAI("/v1/knowledge/ingest-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.ok ? 200 : 502 });
}
