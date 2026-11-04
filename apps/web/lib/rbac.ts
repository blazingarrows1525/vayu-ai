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

/** Roles that can be granted through the members API — ownership is never assignable. */
export const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/** A member may only grant roles strictly below their own (owner → admin, admin → editor). */
export function canAssignRole(actor: Role, role: Role): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[role];
}

/** A member may only change or remove members ranked strictly below them, so the owner (and
 *  therefore the last owner) can never be demoted or removed through the API. */
export function canManageMember(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
