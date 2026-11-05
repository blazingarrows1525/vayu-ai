import { expect, test } from "@playwright/test";
import { signUpUser } from "./helpers";

/** Shared experience contracts: page titles, keyboard entry points, boundaries and list states. */

test("an unknown route returns 404 with a titled page and a way back", async ({ page }) => {
  const res = await page.goto("/no-such-page-here");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found · VAYU AI");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
});

test("the first Tab stop is a skip link that moves focus to the main content", async ({ page }) => {
  await page.goto("/no-such-page-here");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("an empty workspace offers one create action, and a double click creates one document", async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  await signUpUser(ctx, "docs-empty");
  const page = await ctx.newPage();

  await page.goto("/docs");
  await expect(page).toHaveTitle("Documents · VAYU AI");
  await expect(page.getByRole("heading", { name: "No documents yet" })).toBeVisible();
  const create = page.getByRole("button", { name: "New document" });
  await expect(create).toHaveCount(1);

  await create.dblclick();
  await expect(page).toHaveURL(/\/docs\/[0-9a-f-]{36}$/);
  const { documents } = (await (await ctx.request.get("/api/documents")).json()) as { documents: unknown[] };
  expect(documents).toHaveLength(1);

  await page.goto("/docs");
  await expect(page.getByRole("link", { name: /Untitled/ })).toBeVisible();
  await expect(page.getByText("1 document, most recently edited first.", { exact: false })).toBeVisible();
  await ctx.close();
});

test("the landing page makes no invented claims, and phones get the static core instead of WebGL", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const text = await page.locator("body").innerText();
  for (const claim of ["99.9", "agents online", "tokens streamed", "v1.0", "14 modules", "checkpointed", "claude-sonnet", "— free"]) {
    expect(text, `landing should not claim "${claim}"`).not.toContain(claim);
  }
  await page.waitForTimeout(1500);
  await expect(page.locator("canvas")).toHaveCount(0);
  await ctx.close();
});
