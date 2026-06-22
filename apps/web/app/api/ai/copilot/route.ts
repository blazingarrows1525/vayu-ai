import { aiGeneration, db } from "@vayu/db";
import { getServiceToken } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8787";

/**
 * Streaming copilot proxy: authorize → mint JWT → forward to FastAPI → relay SSE
 * to the browser while teeing the `usage` event into the ai_generation ledger.
 */
export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) {
    return Response.json({ error: "forbidden" }, { status: ctx.status });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const token = await getServiceToken();
  if (!token) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const upstream = await fetch(`${AI_SERVICE_URL}/v1/copilot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: "intelligence plane error", status: upstream.status },
      { status: 502 },
    );
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Record<string, unknown> | null = null;

  const tee = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk); // pass straight through to the browser
      buffer += decoder.decode(chunk, { stream: true });
      let i: number;
      while ((i = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const lines = frame.split("\n");
        const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
        const data = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
        if (ev === "usage" && data) {
          try {
            usage = JSON.parse(data) as Record<string, unknown>;
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    },
    async flush() {
      if (!usage) return;
      try {
        await db.insert(aiGeneration).values({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          documentId: typeof body.documentId === "string" ? body.documentId : null,
          command: String(body.command ?? "/unknown"),
          provider: String(usage.provider ?? "anthropic"),
          model: String(usage.model ?? "unknown"),
          promptTokens: Number(usage.promptTokens ?? 0),
          completionTokens: Number(usage.completionTokens ?? 0),
          costUsd: Number(usage.costUsd ?? 0),
          latencyMs: 0,
          status: "completed",
        });
      } catch {
        /* ledger write is best-effort; never break the stream */
      }
    },
  });

  return new Response(upstream.body.pipeThrough(tee), {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}
