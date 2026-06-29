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
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Tester");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder(/password/i).fill("e2e-password-123");
  await page.getByRole("button", { name: /create account/i }).click();
  // Better Auth auto-signs-in on signup and the form pushes to /dashboard.
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

test("authenticated user can open the research center", async ({ page }) => {
  await signUp(page);
  await page.goto("/research");
  await expect(
    page.getByRole("heading", { name: /research center/i }),
  ).toBeVisible();
});
