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

/** Server-to-server call into the intelligence plane, authenticated as the user. */
export async function callAI(path: string, init?: RequestInit): Promise<Response> {
  const token = await getServiceToken();
  if (!token) throw new Error("No active session — cannot call the intelligence plane");

  return fetch(`${AI_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}
