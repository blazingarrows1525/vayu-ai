import { runDiagnostics } from "@/lib/diagnostics";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runDiagnostics();
  return Response.json(
    { ...result, checkedAt: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
