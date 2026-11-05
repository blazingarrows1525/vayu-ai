import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { signUpUser } from "./helpers";

/** The signed-in shell: header context, account menu, module navigation and workspace switching. */

test.describe.configure({ mode: "serial" });

type Workspace = { id: string; name: string; role: string; active: boolean };

async function workspacesOf(ctx: BrowserContext): Promise<Workspace[]> {
  return ((await (await ctx.request.get("/api/workspaces")).json()) as { workspaces: Workspace[] }).workspaces;
}

function jwtClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
}

async function tokenWorkspace(ctx: BrowserContext): Promise<unknown> {
  const { token } = (await (await ctx.request.get("/api/auth/token")).json()) as { token: string };
  return jwtClaims(token).workspace_id;
}

async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: /^Account:/ }).click();
  return page.getByRole("dialog", { name: "Account" });
}

test("the header names the workspace and the dock marks the current module", async ({ browser }) => {
  test.setTimeout(60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const email = await signUpUser(ctx, "shell-header");
  const page = await ctx.newPage();
  await page.goto("/docs");

  const [own] = await workspacesOf(ctx);
  await expect(page.getByRole("banner").getByRole("button", { name: new RegExp(own!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
  const modules = page.getByRole("navigation", { name: "Modules" });
  await expect(modules.getByRole("link", { name: "Documents" })).toHaveAttribute("aria-current", "page");
  await expect(modules.getByRole("link", { name: "Research" })).not.toHaveAttribute("aria-current", "page");

  // Account menu: identity, keyboard dismissal, sign-out.
  const menu = await openAccountMenu(page);
  await expect(menu.getByText(email)).toBeVisible();
  await expect(menu.getByText("Owner in this workspace")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await (await openAccountMenu(page)).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/docs");
  await expect(page).toHaveURL(/\/login/);
  await ctx.close();
});

test("on a phone, four modules are pinned and More lists the rest", async ({ browser }) => {
  test.setTimeout(60_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await signUpUser(ctx, "shell-phone");
  const page = await ctx.newPage();
  await page.goto("/dashboard");

  const bar = page.getByRole("navigation", { name: "Modules" });
  for (const name of ["Home", "Documents", "Research", "Live"]) await expect(bar.getByRole("link", { name })).toBeVisible();
  await bar.getByRole("button", { name: "More" }).click();
  const sheet = page.getByRole("dialog", { name: "All modules" });
  await expect(sheet).toBeVisible();
  for (const name of ["Scratchpad", "Agents", "Vault", "Voice", "Media", "Analytics", "Status", "Members"]) {
    await expect(sheet.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await bar.getByRole("button", { name: "More" }).click();
  await sheet.getByRole("link", { name: /^Agents/ }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await expect(sheet).toBeHidden();
  await ctx.close();
});

test("an invited member switches into the inviter's workspace, and the AI token follows", async ({ browser }) => {
  test.setTimeout(120_000);
  const a = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const b = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await signUpUser(a, "shell-owner");
  const bEmail = await signUpUser(b, "shell-guest");
  const [aWs] = await workspacesOf(a);
  const [bWs] = await workspacesOf(b);

  const created = await a.request.post("/api/documents", { data: { title: "Owner's shared plan" } });
  expect(created.status()).toBe(201);
  expect((await a.request.post("/api/members", { data: { email: bEmail, role: "editor" } })).status()).toBe(201);

  // B now belongs to two workspaces but still acts in their own.
  const before = await workspacesOf(b);
  expect(before.map((w) => w.id).sort()).toEqual([aWs!.id, bWs!.id].sort());
  expect(before.find((w) => w.active)?.id).toBe(bWs!.id);
  expect(await tokenWorkspace(b)).toBe(bWs!.id);

  // Switch through the header.
  const page = await b.newPage();
  await page.goto("/docs");
  await expect(page.getByRole("link", { name: /Owner's shared plan/ })).toHaveCount(0);
  await page.getByRole("banner").getByRole("button", { name: /switch workspace/ }).click();
  const picker = page.getByRole("dialog", { name: "Workspaces" });
  await picker.getByRole("button", { name: new RegExp(aWs!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await expect(page.getByRole("link", { name: /Owner's shared plan/ })).toBeVisible();
  await expect(page).toHaveURL(/\/docs$/);

  // Every plane sees the switch: the BFF scopes data, and the intelligence-plane JWT carries it.
  expect((await workspacesOf(b)).find((w) => w.active)?.id).toBe(aWs!.id);
  expect(await tokenWorkspace(b)).toBe(aWs!.id);
  expect((await b.request.post("/api/documents", { data: { title: "Guest draft" } })).status()).toBe(201);

  // Only member workspaces can be chosen; nothing reveals whether another id exists.
  const stranger = await b.request.put("/api/workspaces/active", { data: { workspaceId: crypto.randomUUID() } });
  expect(stranger.status()).toBe(404);
  const malformed = await b.request.put("/api/workspaces/active", { data: { workspaceId: "not-a-uuid" } });
  expect(malformed.status()).toBe(400);

  // Removed from the workspace: B falls back to their own, without signing in again.
  const members = ((await (await a.request.get("/api/members")).json()) as { members: { userId: string; email: string }[] }).members;
  const guestId = members.find((m) => m.email === bEmail)!.userId;
  expect((await a.request.delete(`/api/members/${guestId}`)).status()).toBe(200);
  expect((await workspacesOf(b)).map((w) => w.id)).toEqual([bWs!.id]);
  expect(await tokenWorkspace(b)).toBe(bWs!.id);
  const docs = ((await (await b.request.get("/api/documents")).json()) as { documents: { title: string }[] }).documents;
  expect(docs.map((d) => d.title)).not.toContain("Owner's shared plan");

  await a.close();
  await b.close();
});
