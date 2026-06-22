import { callAI } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const res = await callAI("/v1/knowledge", { method: "GET" });
  const data = await res.json().catch(() => ({ sources: [] }));
  return Response.json(data, { status: res.ok ? 200 : 502 });
}
