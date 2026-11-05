import { describe, expect, it } from "vitest";
import { plural, timeAgo } from "./format";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000);

describe("timeAgo", () => {
  it("reads recent edits as just now", () => {
    expect(timeAgo(ago(0), NOW)).toBe("just now");
    expect(timeAgo(ago(44), NOW)).toBe("just now");
  });

  it("uses the largest whole unit", () => {
    expect(timeAgo(ago(50), NOW)).toBe("1 minute ago");
    expect(timeAgo(ago(5 * 60), NOW)).toBe("5 minutes ago");
    expect(timeAgo(ago(3 * 3600), NOW)).toBe("3 hours ago");
    expect(timeAgo(ago(86_400), NOW)).toBe("yesterday");
    expect(timeAgo(ago(3 * 604_800), NOW)).toBe("3 weeks ago");
    expect(timeAgo(ago(400 * 86_400), NOW)).toBe("last year");
  });

  it("treats a timestamp slightly in the future (clock skew) as now", () => {
    expect(timeAgo(new Date(NOW + 30_000), NOW)).toBe("just now");
  });

  it("returns an empty string for an invalid date", () => {
    expect(timeAgo("not a date", NOW)).toBe("");
  });
});

describe("plural", () => {
  it("picks the singular only for one", () => {
    expect(plural(0, "document")).toBe("0 documents");
    expect(plural(1, "document")).toBe("1 document");
    expect(plural(1200, "search", "searches")).toBe("1,200 searches");
  });
});
