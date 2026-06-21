import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@vayu/db";
import { auth } from "./auth";
import { can, type Permission } from "./rbac";
import { resolveTokenWorkspace } from "./workspace";

/** Request-memoized session lookup (safe to call from multiple components). */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** The active workspace + role for the current user, or null. */
export async function getActiveMembership(): Promise<
  { workspaceId: string; role: Role } | null
> {
  const session = await getSession();
  if (!session) return null;
  return resolveTokenWorkspace(session.user.id, null);
}

type PermissionCheck =
  | { ok: true; userId: string; workspaceId: string; role: Role }
  | { ok: false; status: 401 | 403 };

/** For API route handlers: returns a status instead of redirecting. */
export async function checkPermission(
  permission: Permission,
): Promise<PermissionCheck> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401 };
  const m = await resolveTokenWorkspace(session.user.id, null);
  if (!m || !can(m.role, permission)) return { ok: false, status: 403 };
  return { ok: true, userId: session.user.id, workspaceId: m.workspaceId, role: m.role };
}
