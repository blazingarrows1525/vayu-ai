import { type APIRequestContext, type BrowserContext, expect, test } from "@playwright/test";
import { signUpUser } from "./helpers";

/**
 * Tenant isolation + authorization on the BFF, against the real database. Two users sign up into
 * their own workspaces; user B must not be able to read or change anything of user A's by id.
 */

test.describe.configure({ mode: "serial" });

type User = { ctx: BrowserContext; api: APIRequestContext; email: string; userId: string };
const users: Record<"a" | "b", User> = {} as never;

async function signUp(ctx: BrowserContext, label: string): Promise<User> {
  const email = await signUpUser(ctx, `sec-${label}`, "sec-password-123");
  const members = (await (await ctx.request.get("/api/members")).json()) as {
    members: { userId: string; email: string }[];
  };
  const me = members.members.find((m) => m.email === email);
  if (!me) throw new Error("own membership not found");
  return { ctx, api: ctx.request, email, userId: me.userId };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  users.a = await signUp(await browser.newContext(), "a");
  users.b = await signUp(await browser.newContext(), "b");
});

test.afterAll(async () => {
  await users.a?.ctx.close();
  await users.b?.ctx.close();
});

async function makeDocument(api: APIRequestContext, title: string, text: string) {
  const { id } = (await (await api.post("/api/documents", { data: { title } })).json()) as { id: string };
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
  const saved = await api.patch(`/api/documents/${id}`, { data: { content, contentText: text } });
  expect(saved.status()).toBe(200);
  return id;
}

test("another workspace can't read or change a document's comments, versions or snapshots", async () => {
  const { a, b } = users;
  const id = await makeDocument(a.api, "A's plan", "top secret launch date");
  const comment = (await (await a.api.post(`/api/documents/${id}/comments`, { data: { body: "keep quiet" } })).json()) as { id: string };
  expect((await a.api.post(`/api/documents/${id}/versions`)).status()).toBe(201);

  expect((await b.api.get(`/api/documents/${id}`)).status()).toBe(404);
  expect((await b.api.get(`/api/documents/${id}/comments`)).status()).toBe(404);
  expect((await b.api.post(`/api/documents/${id}/comments`, { data: { body: "hi" } })).status()).toBe(404);
  expect(
    (await b.api.patch(`/api/documents/${id}/comments`, { data: { commentId: comment.id, resolved: true } })).status(),
  ).toBe(404);
  expect((await b.api.get(`/api/documents/${id}/versions`)).status()).toBe(404);
  const restore = await b.api.post(`/api/documents/${id}/restore`, { data: { version: 1 } });
  expect(restore.status()).toBe(404);
  expect(await restore.text()).not.toContain("top secret");
  expect((await b.api.patch(`/api/documents/${id}`, { data: { title: "pwned" } })).status()).toBe(404);

  // A's data is untouched.
  const doc = (await (await a.api.get(`/api/documents/${id}`)).json()) as { title: string };
  expect(doc.title).toBe("A's plan");
  const { comments } = (await (await a.api.get(`/api/documents/${id}/comments`)).json()) as {
    comments: { resolved: boolean }[];
  };
  expect(comments).toHaveLength(1);
  expect(comments[0]?.resolved).toBe(false);
});

test("a comment can only be resolved through its own document", async () => {
  const { a } = users;
  const first = await makeDocument(a.api, "first", "one");
  const second = await makeDocument(a.api, "second", "two");
  const c = (await (await a.api.post(`/api/documents/${first}/comments`, { data: { body: "note" } })).json()) as { id: string };
  expect(
    (await a.api.patch(`/api/documents/${second}/comments`, { data: { commentId: c.id, resolved: true } })).status(),
  ).toBe(404);
  expect(
    (await a.api.patch(`/api/documents/${first}/comments`, { data: { commentId: c.id, resolved: true } })).status(),
  ).toBe(200);
});

test("document PATCH only writes title and content", async () => {
  const { a } = users;
  const id = await makeDocument(a.api, "Before", "body");
  const res = await a.api.patch(`/api/documents/${id}`, {
    data: {
      title: "After",
      isArchived: true,
      workspaceId: "00000000-0000-0000-0000-000000000000",
      createdBy: "00000000-0000-0000-0000-000000000000",
      currentVersion: 99,
    },
  });
  expect(res.status()).toBe(200);
  const doc = (await (await a.api.get(`/api/documents/${id}`)).json()) as {
    title: string;
    isArchived: boolean;
    currentVersion: number;
  };
  expect(doc).toMatchObject({ title: "After", isArchived: false, currentVersion: 1 });
  const { documents } = (await (await a.api.get("/api/documents")).json()) as { documents: { id: string }[] };
  expect(documents.map((d) => d.id)).toContain(id);
});

test("restoring a version snapshots the current content first", async () => {
  const { a } = users;
  const id = await makeDocument(a.api, "Versioned", "first draft");
  expect((await a.api.post(`/api/documents/${id}/versions`)).status()).toBe(201); // v1 = first draft
  const second = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "second draft" }] }] };
  await a.api.patch(`/api/documents/${id}`, { data: { content: second, contentText: "second draft" } });

  const res = await a.api.post(`/api/documents/${id}/restore`, { data: { version: 1 } });
  expect(res.status()).toBe(200);
  expect((await res.json()) as { backupVersion: number }).toMatchObject({ backupVersion: 2 });
  const { versions } = (await (await a.api.get(`/api/documents/${id}/versions`)).json()) as {
    versions: { version: number; summary: string }[];
  };
  expect(versions.find((v) => v.version === 2)?.summary).toBe("Before restoring v1");
  const doc = (await (await a.api.get(`/api/documents/${id}`)).json()) as { contentText: string };
  expect(doc.contentText).toContain("first draft");
});

test("members API refuses owner grants, unknown roles and self-changes", async () => {
  const { a, b } = users;
  expect((await a.api.post("/api/members", { data: { email: b.email, role: "owner" } })).status()).toBe(400);
  expect((await a.api.post("/api/members", { data: { email: b.email, role: "superuser" } })).status()).toBe(400);
  expect((await a.api.patch(`/api/members/${a.userId}`, { data: { role: "viewer" } })).status()).toBe(403);
  expect((await a.api.delete(`/api/members/${a.userId}`)).status()).toBe(403);

  expect((await a.api.post("/api/members", { data: { email: b.email.toUpperCase(), role: "editor" } })).status()).toBe(201);
  expect((await a.api.patch(`/api/members/${b.userId}`, { data: { role: "owner" } })).status()).toBe(400);
  expect((await a.api.patch(`/api/members/${b.userId}`, { data: { role: "admin" } })).status()).toBe(200);
  expect((await a.api.delete(`/api/members/${b.userId}`)).status()).toBe(200);
});

test("email sign-in never follows an off-origin redirect", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login?redirect=%2F%09%2Fexample.com");
  await page.getByLabel("Email").fill(users.a.email);
  await page.getByLabel("Password").fill("sec-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await ctx.close();
});
