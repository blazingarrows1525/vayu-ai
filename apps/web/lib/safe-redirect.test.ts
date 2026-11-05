import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("keeps same-origin paths, including query and hash", () => {
    expect(safeRedirect("/live")).toBe("/live");
    expect(safeRedirect("/docs/abc?tab=history#v2")).toBe("/docs/abc?tab=history#v2");
  });

  it("falls back when there is nothing to redirect to", () => {
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
    expect(safeRedirect(undefined, "/docs")).toBe("/docs");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com", // what URLSearchParams.get() yields for "/%09/evil.com"
    "\\\\evil.com",
    "https://evil.com/x",
    "javascript:alert(1)",
    " //evil.com",
  ])("rejects off-origin target %j", (raw) => {
    expect(safeRedirect(raw)).toBe("/dashboard");
  });
});
