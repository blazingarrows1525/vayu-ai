import { headers } from "next/headers";
import { auth } from "./auth";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8787";

/**
 * Mint a short-lived access JWT for the current session. This is the token the
 * BFF forwards to the intelligence plane, which verifies it via JWKS.
 */
export async function getServiceToken(): Promise<string | null> {
  const res = await auth.api.getToken({ headers: await headers() });
  return res?.token ?? null;
}

/** User-facing reason for an AI-plane failure the UI would otherwise show as a bare error. */
export function aiFailureMessage(status: number | null, detail?: string): string | null {
  if (status === null) return "The AI service is unreachable. Open /status to see why.";
  if (status === 401 || status === 403)
    return "The AI service rejected your login. Open /status to see why.";
  if (status === 503) return `${detail ?? "This AI feature isn't configured."} Open /status to fix it.`;
  return null;
}

/** Server-to-server call into the intelligence plane, authenticated as the user. A network
 *  failure becomes a 502 JSON response instead of an exception every caller must catch. */
export async function callAI(path: string, init?: RequestInit): Promise<Response> {
  const token = await getServiceToken();
  if (!token) throw new Error("No active session — cannot call the intelligence plane");

  try {
    return await fetch(`${AI_SERVICE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: aiFailureMessage(null) }, { status: 502 });
  }
}
