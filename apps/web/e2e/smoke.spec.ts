import { expect, test } from "@playwright/test";

test("landing renders the hero and the floating AI dock", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /intelligence at the speed of thought/i }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: /vayu navigation/i })).toBeVisible();
});

test("sign-in page renders its OAuth options", async ({ page }) => {
  // Auth is OAuth-only: the login page offers provider buttons, not a password form.
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
});

test("protected route redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
