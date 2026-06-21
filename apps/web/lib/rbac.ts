import type { Role } from "@vayu/db";

/** Role hierarchy, most → least privileged. */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function hasRole(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Each permission maps to the minimum role that grants it. */
export const PERMISSIONS = {
  "document:read": "viewer",
  "document:write": "editor",
  "document:delete": "editor",
  "workspace:manageMembers": "admin",
  "workspace:updateSettings": "admin",
  "workspace:delete": "owner",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission]);
}
