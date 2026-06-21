import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { checkPermission } from "@/lib/session";

/**
 * Demonstrates the full bridge: browser → BFF (authz) → mint JWT → FastAPI
 * (verifies via JWKS) → response. Listing agents needs at least read access.
 */
export async function GET() {
  const auth = await checkPermission("document:read");
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const res = await callAI("/v1/agents");
  if (!res.ok) {
    return NextResponse.json(
      { error: "intelligence plane error", status: res.status },
      { status: 502 },
    );
  }
  return NextResponse.json(await res.json());
}
