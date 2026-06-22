import { getServiceToken } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8787";

/** Relays the agent's live per-node SSE progress to the browser. */
export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const { agentType, task } = (await req.json()) as { agentType: string; task: string };
  const token = await getServiceToken();
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

  const upstream = await fetch(
    `${AI_SERVICE_URL}/v1/agents/${encodeURIComponent(agentType)}/stream`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ task }),
    },
  );
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: "intelligence plane error", status: upstream.status },
      { status: 502 },
    );
  }
  return new Response(upstream.body, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}
