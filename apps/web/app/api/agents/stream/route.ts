import { aiFailureMessage, getServiceToken } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8787";
const AGENT_TYPE = /^[a-z0-9_-]{1,40}$/;
const MAX_TASK = 4000;

/** Relays the agent's live per-node SSE progress (step frames, then a `result`) to the browser. */
export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const body = (await req.json().catch(() => null)) as { agentType?: unknown; task?: unknown } | null;
  const agentType = typeof body?.agentType === "string" ? body.agentType : "";
  const task = typeof body?.task === "string" ? body.task.trim() : "";
  if (!AGENT_TYPE.test(agentType)) return Response.json({ error: "Choose an agent." }, { status: 400 });
  if (!task) return Response.json({ error: "Describe the task first." }, { status: 400 });
  if (task.length > MAX_TASK) {
    return Response.json({ error: `Tasks are limited to ${MAX_TASK.toLocaleString("en")} characters.` }, { status: 400 });
  }

  const token = await getServiceToken();
  if (!token) return Response.json({ error: "Your session has ended. Sign in again." }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${AI_SERVICE_URL}/v1/agents/${encodeURIComponent(agentType)}/stream`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ task }),
      // Stop in the UI aborts this request; pass it on so the agent run ends upstream too.
      signal: req.signal,
    });
  } catch {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ error: aiFailureMessage(null) }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const message =
      upstream.status === 404
        ? "That agent doesn't exist."
        : (aiFailureMessage(upstream.status) ?? `The agent service returned an error (${upstream.status}).`);
    return Response.json({ error: message, status: upstream.status }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}
