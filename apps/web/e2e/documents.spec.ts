import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { signUpUser } from "./helpers";

/** Writing in a document: save integrity, history, comments, Copilot, roles and the scratchpad. */

test.describe.configure({ mode: "serial" });

let owner: BrowserContext;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(60_000);
  owner = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await signUpUser(owner, "docs-owner");
});

test.afterAll(async () => {
  await owner?.close();
});

async function newDocument(ctx: BrowserContext, title: string, text?: string): Promise<string> {
  const { id } = (await (await ctx.request.post("/api/documents", { data: { title } })).json()) as { id: string };
  if (text) {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
    expect((await ctx.request.patch(`/api/documents/${id}`, { data: { title, content, contentText: text } })).status()).toBe(200);
  }
  return id;
}

async function openDoc(page: Page, id: string) {
  page.on("dialog", (d) => void d.accept()); // leave-page prompts while unsaved
  await page.goto(`/docs/${id}`);
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

const saved = (page: Page) => page.getByText(/^Saved (just now|\d+ (seconds?|minutes?) ago)$/);

test("edits autosave, and the saved text survives a reload", async () => {
  const id = await newDocument(owner, "Autosave check");
  const page = await owner.newPage();
  await openDoc(page, id);
  await expect(page).toHaveTitle("Autosave check · VAYU AI");

  await page.getByLabel("Document title").fill("Quarterly plan");
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Ship the editor in November.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(saved(page)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue("Quarterly plan");
  await expect(page.locator(".ProseMirror")).toContainText("Ship the editor in November.");
  await page.close();
});

test("an unknown or malformed document id is a 404 inside the app", async () => {
  const page = await owner.newPage();
  for (const id of [crypto.randomUUID(), "not-a-real-id"]) {
    const res = await page.goto(`/docs/${id}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /This isn.t in your workspace/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Modules" })).toBeVisible();
  }
  await page.close();
});

test("a failed save keeps the edits: it says so, retries, and recovers them after a reload", async () => {
  const id = await newDocument(owner, "Failure check", "Original text.");
  const page = await owner.newPage();
  await openDoc(page, id);

  const failSaves = (route: import("@playwright/test").Route) =>
    route.request().method() === "PATCH" ? route.fulfill({ status: 500, body: "{}" }) : route.continue();
  await page.route(`**/api/documents/${id}`, failSaves);
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Added while the server fails.");
  const alert = page.getByRole("alert").filter({ hasText: "Your latest changes aren't saved yet" });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Not saved")).toBeVisible();

  // Reload while saving still fails: the local backup is offered back.
  await page.reload();
  await expect(page.getByText("Unsaved changes found on this device")).toBeVisible();
  await page.unroute(`**/api/documents/${id}`, failSaves);
  await page.getByRole("button", { name: "Restore them" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Added while the server fails.");
  await expect(saved(page)).toBeVisible({ timeout: 10_000 });

  const stored = (await (await owner.request.get(`/api/documents/${id}`)).json()) as { contentText: string };
  expect(stored.contentText).toContain("Added while the server fails.");
  await page.close();
});

test("history: snapshot, compare, and a confirmed restore that keeps a backup", async () => {
  const id = await newDocument(owner, "History check", "First draft.");
  const page = await owner.newPage();
  await openDoc(page, id);
  await page.getByRole("tab", { name: /History/ }).click();
  const history = page.getByRole("tabpanel", { name: /History/ });

  await history.getByRole("button", { name: "Save a snapshot" }).click();
  await expect(history.getByText("Saved snapshot v1.")).toBeVisible();

  await page.locator(".ProseMirror").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Second thoughts.");
  await history.getByRole("button", { name: "Save a snapshot" }).click(); // waits for the save first
  await expect(history.getByText("Saved snapshot v2.")).toBeVisible();

  await history.getByRole("button", { name: "Changes since v1" }).click();
  await expect(history.locator("ins")).toContainText("Second thoughts.");

  // Restore v1 through the confirmation dialog.
  await history.getByRole("listitem").filter({ hasText: "Version 1" }).getByRole("button", { name: "Restore" }).click();
  const dialog = page.getByRole("dialog", { name: "Restore version 1?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Restore" }).click();
  await expect(history.getByText(/Restored v1\. The text you had is kept as v3\./)).toBeVisible();
  await expect(page.locator(".ProseMirror")).not.toContainText("Second thoughts.");
  await expect(history.getByText("Before restoring v1")).toBeVisible();
  await page.close();
});

test("comments can be posted and resolved", async () => {
  const id = await newDocument(owner, "Comment check", "Text to discuss.");
  const page = await owner.newPage();
  await openDoc(page, id);
  await page.getByRole("tab", { name: /Comments/ }).click();
  const panel = page.getByRole("tabpanel", { name: /Comments/ });
  await expect(panel.getByRole("heading", { name: "No comments yet" })).toBeVisible();

  await panel.getByRole("textbox", { name: "Add a comment" }).fill("Can we cut the second paragraph?");
  await panel.getByRole("button", { name: "Comment" }).click();
  const open = panel.getByRole("list", { name: "Open comments" });
  await expect(open).toContainText("Can we cut the second paragraph?");
  await expect(page.getByRole("tab", { name: /Comments/ })).toContainText("1");

  await open.getByRole("button", { name: "Resolve" }).click();
  await expect(panel.getByText("Every comment is resolved.")).toBeVisible();
  await expect(panel.getByText("Resolved (1)")).toBeVisible();
  await page.close();
});

test("Copilot answers into the side panel and inserts the reply as editor blocks", async () => {
  const id = await newDocument(owner, "Copilot check", "A rough sentence that needs work.");
  const page = await owner.newPage();
  await openDoc(page, id);
  const copilot = page.getByRole("tabpanel", { name: /Copilot/ });
  await expect(copilot.getByText("Works on the whole text. Select a passage to focus it.")).toBeVisible();

  await copilot.getByRole("button", { name: "Run Copilot" }).click();
  const result = copilot.getByRole("region", { name: "Copilot result" });
  await expect(result).toContainText("fake Gemini model replying", { timeout: 20_000 });
  await result.getByRole("button", { name: "Insert below" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("fake Gemini model replying");
  await expect(saved(page)).toBeVisible({ timeout: 10_000 });
  await page.close();
});

test("a viewer reads the document without editing tools", async ({ browser }) => {
  test.setTimeout(60_000);
  const id = await newDocument(owner, "Read-only check", "Visible to viewers.");
  const viewer = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const email = await signUpUser(viewer, "docs-viewer");
  expect((await owner.request.post("/api/members", { data: { email, role: "viewer" } })).status()).toBe(201);
  const { workspaces } = (await (await owner.request.get("/api/workspaces")).json()) as { workspaces: { id: string }[] };
  expect((await viewer.request.put("/api/workspaces/active", { data: { workspaceId: workspaces[0]!.id } })).status()).toBe(200);

  const page = await viewer.newPage();
  await page.goto(`/docs/${id}`);
  await expect(page.locator(".ProseMirror")).toContainText("Visible to viewers.");
  await expect(page.getByText("View only")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "false");
  await expect(page.getByLabel("Document title")).toHaveAttribute("readonly", "");
  await expect(page.getByRole("tab", { name: "Copilot" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Add a comment" })).toHaveCount(0);
  await viewer.close();
});

test("the scratchpad keeps a draft in the browser and saves it as a document", async () => {
  const page = await owner.newPage();
  await page.goto("/editor");
  await expect(page).toHaveTitle("Scratchpad · VAYU AI");
  const save = page.getByRole("button", { name: "Save as document" });
  await expect(save).toBeDisabled();

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Scratch idea worth keeping");
  await expect(page.getByText(/Kept in this browser · updated/)).toBeVisible();
  await page.reload();
  await expect(page.locator(".ProseMirror")).toContainText("Scratch idea worth keeping");

  await page.getByRole("button", { name: "Save as document" }).click();
  await expect(page).toHaveURL(/\/docs\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Document title")).toHaveValue("Scratch idea worth keeping");
  await expect(page.locator(".ProseMirror")).toContainText("Scratch idea worth keeping");
  await page.goto("/editor");
  await expect(page.locator(".ProseMirror")).not.toContainText("Scratch idea worth keeping");
  await page.close();
});
