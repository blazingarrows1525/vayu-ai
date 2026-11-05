import { type BrowserContext, expect, test } from "@playwright/test";
import { aiPlaneAvailable, NEEDS_AI, signUpUser } from "./helpers";

/** Members, status, sign-in, voice, media, Live and the legal pages. */

test.describe.configure({ mode: "serial" });
// A fake microphone (a steady tone) so the voice paths run for real.
// (launchOptions replaces the whole object, so a local browser path is passed through.)
test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  },
});

let owner: BrowserContext;
let guest: BrowserContext;
let guestEmail = "";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  owner = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await signUpUser(owner, "tools-owner");
  guestEmail = await signUpUser(guest, "tools-guest");
});

test.afterAll(async () => {
  await owner?.close();
  await guest?.close();
});

test("members: invite with clear errors, change a role, and remove only after confirming", async () => {
  const page = await owner.newPage();
  await page.goto("/settings/members");
  await expect(page).toHaveTitle("Members · VAYU AI");

  await page.getByRole("textbox", { name: "Email" }).fill("nobody-here@example.com");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("Nobody has a VAYU account with that email yet.", { exact: false })).toBeVisible();

  await page.getByRole("textbox", { name: "Email" }).fill(guestEmail);
  await page.getByLabel("Role", { exact: true }).selectOption("editor");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Added ${guestEmail} as Editor.`, { exact: false })).toBeVisible();

  const roleSelect = page.getByRole("combobox", { name: /^Role for / });
  await roleSelect.selectOption("viewer");
  await expect(page.getByText(/is now Viewer\./)).toBeVisible();

  await page.getByRole("button", { name: /^Remove / }).click();
  const dialog = page.getByRole("dialog", { name: /^Remove / });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("combobox", { name: /^Role for / })).toBeVisible();

  await page.getByRole("button", { name: /^Remove / }).click();
  await page.getByRole("dialog", { name: /^Remove / }).getByRole("button", { name: "Remove member" }).click();
  await expect(page.getByText(/^Removed .* from /)).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Role for / })).toHaveCount(0);

  // Re-invite as a viewer for the next check.
  await page.getByRole("textbox", { name: "Email" }).fill(guestEmail);
  await page.getByLabel("Role", { exact: true }).selectOption("viewer");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Added ${guestEmail} as Viewer.`, { exact: false })).toBeVisible();
  await page.close();
});

test("members: a viewer sees the list without management controls", async () => {
  const { workspaces } = (await (await guest.request.get("/api/workspaces")).json()) as { workspaces: { id: string; role: string }[] };
  const shared = workspaces.find((w) => w.role === "viewer")!;
  expect((await guest.request.put("/api/workspaces/active", { data: { workspaceId: shared.id } })).status()).toBe(200);
  const page = await guest.newPage();
  await page.goto("/settings/members");
  await expect(page.getByText("Admins and owners manage membership.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Role for / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await page.close();
});

test("status lists each check with a labelled state", async () => {
  const page = await owner.newPage();
  await page.goto("/status");
  await expect(page).toHaveTitle("Service status · VAYU AI");
  await expect(page.getByRole("heading", { name: "App database" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Everything is working\.|to fix|Working, with/)).toBeVisible();
  await page.close();
});

test("sign-in: labelled fields, show password, network errors recover, signed-in users skip it", async ({ browser }) => {
  const anon = await browser.newContext();
  const page = await anon.newPage();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  const password = page.getByLabel("Password", { exact: true });
  await page.getByLabel("Email").fill("someone@example.com");
  await password.fill("not-the-password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");

  await page.route("**/api/auth/sign-in/email", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Couldn't reach VAYU. Check your connection and try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page).toHaveURL(/mode=signup/);
  await anon.close();

  const signedIn = await owner.newPage();
  await signedIn.goto("/login?redirect=/docs");
  await expect(signedIn).toHaveURL(/\/docs$/);
  await signedIn.close();
});

test("voice: the microphone works from the keyboard and shows what was heard", async () => {
  test.skip(!(await aiPlaneAvailable()), NEEDS_AI);
  test.setTimeout(90_000);
  await owner.grantPermissions(["microphone"]);
  const page = await owner.newPage();
  await page.goto("/voice");
  await expect(page).toHaveTitle("Voice · VAYU AI");
  const mic = page.getByRole("button", { name: "Start speaking" });
  await mic.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop and send" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  const convo = page.getByRole("region", { name: "Conversation" });
  await expect(convo).toBeVisible({ timeout: 45_000 });
  await expect(convo).toContainText("fake Gemini");
  await page.close();
});

test("media: keyboard file picking, with non-video files refused clearly", async () => {
  const page = await owner.newPage();
  await page.goto("/media");
  await expect(page.getByRole("button", { name: "Choose a video" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByText('"notes.txt" isn\'t a video file.')).toBeVisible();
  await page.close();
});

test("Live: a refused session goes offline with a reason and recovers with Retry", async () => {
  test.skip(!(await aiPlaneAvailable()), NEEDS_AI);
  test.setTimeout(60_000);
  const page = await owner.newPage();
  await page.route("**/api/realtime/session", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/live");
  await expect(page.getByText("VAYU Live is offline")).toBeVisible();
  await expect(page.getByText(/sign in again/i).first()).toBeVisible();
  await page.unroute("**/api/realtime/session");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("VAYU Live is offline")).toBeHidden({ timeout: 20_000 });
  const mic = page.getByRole("button", { name: "Talk to VAYU" });
  await expect(mic).toBeEnabled({ timeout: 20_000 });
  await mic.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop and send" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await page.close();
});

test("legal pages read clearly in the light theme and show when the text changed", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("Last updated 3 July 2026")).toBeVisible();
  const ratio = await page.evaluate(() => {
    const lum = (c: string) => {
      const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const fg = lum(getComputedStyle(document.querySelector(".prose-vayu p")!).color);
    const bg = lum(getComputedStyle(document.documentElement).backgroundColor);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  expect(ratio).toBeGreaterThan(4.5);
  await ctx.close();
});
