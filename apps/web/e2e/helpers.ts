import type { BrowserContext } from "@playwright/test";

/**
 * Signs a brand-new user up into `ctx` (each gets their own workspace) and returns the email.
 * Better Auth allows 3 sign-ups / 10 s per IP and several specs sign up, so back off on 429.
 */
export async function signUpUser(ctx: BrowserContext, label: string, password = "e2e-password-123"): Promise<string> {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  for (let attempt = 0; ; attempt++) {
    const res = await ctx.request.post("/api/auth/sign-up/email", {
      data: { email, password, name: `E2E ${label}` },
    });
    if (res.ok()) return email;
    if (res.status() !== 429 || attempt >= 7) throw new Error(`sign-up failed: ${res.status()}`);
    await new Promise((r) => setTimeout(r, 10_500));
  }
}

let aiProbe: Promise<boolean> | null = null;

/**
 * Whether the intelligence plane is reachable. CI's e2e job runs the product plane and Postgres
 * only, so journeys that need models (Copilot, research, agents, voice, Live) skip there and run
 * wherever the AI service is up (locally, or against a deployment).
 */
export function aiPlaneAvailable(): Promise<boolean> {
  aiProbe ??= fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:8787"}/v1/health`, { signal: AbortSignal.timeout(3000) })
    .then((res) => res.ok)
    .catch(() => false);
  return aiProbe;
}

export const NEEDS_AI = "needs the intelligence plane (start apps/ai or set AI_SERVICE_URL)";
