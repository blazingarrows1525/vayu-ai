import { type BrowserContext, expect, test } from "@playwright/test";
import { aiPlaneAvailable, NEEDS_AI, signUpUser } from "./helpers";

/** Research, agents, vault and analytics against the real AI plane (with a stand-in model). */

test.describe.configure({ mode: "serial" });

let ctx: BrowserContext;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await signUpUser(ctx, "intel");
});

test.afterAll(async () => {
  await ctx?.close();
});

const NOTES = `# Retrieval notes

Hybrid search combines keyword matching with vector similarity.
Reranking the top candidates improves answer quality for long documents.
`;

test("research: a keyboard-reachable upload, a validated URL field, and answers that name their sources", async () => {
  test.skip(!(await aiPlaneAvailable()), NEEDS_AI);
  test.setTimeout(90_000);
  const page = await ctx.newPage();
  await page.goto("/research");
  await expect(page).toHaveTitle("Research · VAYU AI");
  await expect(page.getByRole("heading", { name: "No sources yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask" })).toBeDisabled();

  // A bad address is explained, and what was typed stays put.
  const urlField = page.getByRole("textbox", { name: "Add a web page" });
  await urlField.fill("notes-dot-com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Enter a full web address starting with http:// or https://")).toBeVisible();
  await expect(urlField).toHaveValue("notes-dot-com");

  await expect(page.getByRole("button", { name: "Choose a file" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "retrieval-notes.md", mimeType: "text/markdown", buffer: Buffer.from(NOTES) });
  await expect(page.getByText('Added "retrieval-notes.md".')).toBeVisible({ timeout: 30_000 });
  const list = page.getByRole("list", { name: "Your sources" });
  await expect(list).toContainText("retrieval-notes.md");

  await page.getByRole("textbox", { name: "Question" }).fill("How does hybrid search work?");
  await page.getByRole("button", { name: "Ask" }).click();
  const answer = page.getByRole("article", { name: "Answer" });
  await expect(answer).toBeVisible({ timeout: 30_000 });
  await expect(answer.getByRole("heading", { name: "How does hybrid search work?" })).toBeVisible();
  await expect(answer.getByText("Cited passages")).toBeVisible();
  await expect(answer.getByRole("listitem").first()).toContainText("retrieval-notes.md");
  await expect(answer).not.toContainText("REF_");
  await expect(page.getByRole("textbox", { name: "Question" })).toHaveValue("How does hybrid search work?");
  await page.close();
});

test("agents: a run streams named steps, then the full result, which can be saved as a document", async () => {
  test.skip(!(await aiPlaneAvailable()), NEEDS_AI);
  test.setTimeout(90_000);
  const page = await ctx.newPage();
  await page.goto("/agents");
  await expect(page).toHaveTitle("Agents · VAYU AI");
  await expect(page.getByRole("heading", { name: "No run yet" })).toBeVisible();
  const radios = page.getByRole("radio");
  await expect(radios.first()).toBeChecked();
  expect(await radios.count()).toBeGreaterThan(1);

  await page.getByRole("textbox", { name: "Task" }).fill("Summarise why hybrid retrieval helps");
  await page.getByRole("button", { name: "Run agent" }).click();
  const result = page.getByRole("region", { name: "Result" });
  await expect(result).toContainText("fake Gemini model replying", { timeout: 45_000 });
  await expect(page.getByRole("list", { name: "Steps" })).toContainText("Reasoning");
  await expect(page.getByText(/^Finished after \d+ steps?$/)).toBeVisible();

  await result.getByRole("button", { name: "Save as document" }).click();
  await result.getByRole("link", { name: "Open the document" }).click();
  await expect(page).toHaveURL(/\/docs\/[0-9a-f-]{36}$/);
  await expect(page.locator(".ProseMirror")).toContainText("fake Gemini model replying");
  await page.close();
});

test("vault: search, save a search, and survive corrupt saved data", async () => {
  test.skip(!(await aiPlaneAvailable()), NEEDS_AI);
  test.setTimeout(60_000);
  const page = await ctx.newPage();
  await page.goto("/vault");
  await expect(page).toHaveTitle("Vault · VAYU AI");
  await page.getByRole("searchbox", { name: "Search your sources" }).fill("vector similarity");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /match "vector similarity"/ })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Save this search" }).click();
  await expect(page.getByRole("button", { name: 'Remove saved search "vector similarity"' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "vector similarity", exact: true })).toBeVisible();

  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("vayu.savedSearches:")) localStorage.setItem(k, "{not json");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Search everything you've added" })).toBeVisible();
  await page.close();
});

test("analytics renders labelled figures from this workspace", async () => {
  const page = await ctx.newPage();
  await page.goto("/analytics");
  await expect(page).toHaveTitle("Analytics · VAYU AI");
  await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Copilot usage" })).toBeVisible();
  await expect(page.getByRole("main").locator("dt", { hasText: /^Documents$/ })).toBeVisible();
  await expect(page.getByText("Estimated cost")).toBeVisible();
  await page.close();
});
