import { aiFailureMessage, getServiceToken } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8787";

/** Forwards a multipart upload to the intelligence plane for ingestion. */
export async function POST(req: Request) {
  const ctx = await checkPermission("document:write");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const token = await getServiceToken();
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  let res: Response;
  try {
    res = await fetch(`${AI_SERVICE_URL}/v1/knowledge/ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }, // boundary set automatically
      body: form,
    });
  } catch {
    return Response.json({ error: aiFailureMessage(null) }, { status: 502 });
  }
  const data = (await res.json().catch(() => ({}))) as { detail?: unknown; error?: string };
  const hint = aiFailureMessage(res.status, typeof data.detail === "string" ? data.detail : undefined);
  if (hint) data.detail = hint;
  // Forward client errors (413 too-large, 415 unsupported) so the UI can show them;
  // collapse anything else to 502 (the AI plane is unreachable / errored).
  const status = res.ok ? 200 : res.status >= 400 && res.status < 500 ? res.status : 502;
  return Response.json(data, { status });
}
