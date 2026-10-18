import { expect, test, type Page } from "@playwright/test";

/**
 * Authenticated journeys against the product plane (Next.js + Postgres). The AI plane is
 * NOT required — these assert that protected page shells render after a real signup, not
 * AI output — so the suite runs in CI with just a database.
 */

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page): Promise<string> {
  const email = uniqueEmail();
  // The visible UI is OAuth-only, so e2e provisions the account through Better
  // Auth's REST API (email/password stays enabled server-side). page.request
  // shares the browser context's cookie jar, so the session cookie from the
  // response logs the page in — the protected shells are then exercised for real.
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password: "e2e-password-123", name: "E2E Tester" },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  return email;
}

test("signup creates a workspace and lands on the dashboard", async ({ page }) => {
  await signUp(page);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("session survives a reload (cookie persists)", async ({ page }) => {
  await signUp(page);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
});

// Better Auth allows 3 sign-ups per 10s per IP in production mode — keep this file at
// three signUp() calls (add assertions to an existing journey rather than a 4th signup).
test("authenticated user can open the research center and VAYU Live", async ({ page }) => {
  await signUp(page);
  await page.goto("/research");
  await expect(
    page.getByRole("heading", { name: /research center/i }),
  ).toBeVisible();

  // VAYU Live: the BFF mints a short-lived JWT + the AI plane's WebSocket URL.
  const res = await page.request.get("/api/realtime/session");
  expect(res.ok()).toBeTruthy();
  const { url, token } = (await res.json()) as { url: string; token: string };
  expect(url).toMatch(/^wss?:\/\/.+\/v1\/ws\/chat$/);
  expect(token.split(".")).toHaveLength(3);

  await page.goto("/live");
  await expect(page.getByRole("heading", { name: "Live" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message VAYU" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Talk to VAYU" })).toBeVisible();
});
