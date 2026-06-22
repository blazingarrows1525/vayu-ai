import { describe, expect, it } from "vitest";
import { ROLE_RANK, can, hasRole } from "./rbac";

describe("rbac", () => {
  it("orders roles owner > admin > editor > viewer", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeGreaterThan(ROLE_RANK.viewer);
  });

  it("hasRole respects the hierarchy", () => {
    expect(hasRole("admin", "editor")).toBe(true);
    expect(hasRole("editor", "editor")).toBe(true);
    expect(hasRole("viewer", "editor")).toBe(false);
    expect(hasRole(null, "viewer")).toBe(false);
  });

  it("can() maps permissions to the minimum role", () => {
    expect(can("editor", "document:write")).toBe(true);
    expect(can("viewer", "document:write")).toBe(false);
    expect(can("admin", "workspace:manageMembers")).toBe(true);
    expect(can("editor", "workspace:manageMembers")).toBe(false);
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(can("admin", "workspace:delete")).toBe(false);
  });
});
