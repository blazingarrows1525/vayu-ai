import { getServiceToken } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

/**
 * What the browser needs to open VAYU Live: the intelligence plane's public WebSocket
 * URL and a short-lived (15 min) access JWT. A route handler can't relay a WebSocket,
 * so the socket goes direct and presents this token as its first frame — the same
 * token Better Auth already serves to the signed-in user at /api/auth/token.
 */
export async function GET() {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const token = await getServiceToken();
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

  const base =
    process.env.AI_PUBLIC_URL || process.env.AI_SERVICE_URL || "http://localhost:8787";
  const url = new URL("/v1/ws/chat", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return Response.json(
    { url: url.toString(), token },
    { headers: { "cache-control": "no-store" } },
  );
}
