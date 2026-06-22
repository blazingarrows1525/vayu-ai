import { getServiceToken } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8787";

export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const { agentType, task } = (await req.json()) as { agentType: string; task: string };
  const token = await getServiceToken();
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

  const res = await fetch(
    `${AI_SERVICE_URL}/v1/agents/${encodeURIComponent(agentType)}/run`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ task }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.ok ? 200 : 502 });
}
