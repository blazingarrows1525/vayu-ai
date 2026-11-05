import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, membership, type Role, session, workspace } from "@vayu/db";

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "workspace";
}

/**
 * Runs after a user is created (Better Auth databaseHook). Gives every new user
 * a personal workspace they own — so they always have a tenant to act within.
 */
export async function bootstrapWorkspace(user: {
  id: string;
  name: string | null;
  email: string;
}): Promise<void> {
  const label = user.name?.trim() || user.email.split("@")[0] || "My";
  const slug = `${slugify(label)}-${randomUUID().slice(0, 8)}`;

  const [ws] = await db
    .insert(workspace)
    .values({ name: `${label}'s Workspace`, slug, ownerId: user.id })
    .returning();
  if (!ws) return;

  await db
    .insert(membership)
    .values({ workspaceId: ws.id, userId: user.id, role: "owner" });
}

/**
 * Resolve the workspace + role to stamp into the JWT. Prefers the session's active workspace
 * (if the user is still a member of it), otherwise the user's first (personal) workspace.
 */
export async function resolveTokenWorkspace(
  userId: string,
  activeWorkspaceId: string | null,
): Promise<{ workspaceId: string; role: Role } | null> {
  if (activeWorkspaceId) {
    const [m] = await db
      .select({ workspaceId: membership.workspaceId, role: membership.role })
      .from(membership)
      .where(
        and(
          eq(membership.userId, userId),
          eq(membership.workspaceId, activeWorkspaceId),
        ),
      )
      .limit(1);
    if (m) return m;
  }

  const [first] = await db
    .select({ workspaceId: membership.workspaceId, role: membership.role })
    .from(membership)
    .where(eq(membership.userId, userId))
    .orderBy(asc(membership.createdAt))
    .limit(1);

  return first ?? null;
}

export type WorkspaceSummary = { id: string; name: string; role: Role };

/** Every workspace the user belongs to, in the same order resolveTokenWorkspace falls back by
 *  (oldest membership first — the personal workspace). */
export async function listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  return db
    .select({ id: workspace.id, name: workspace.name, role: membership.role })
    .from(membership)
    .innerJoin(workspace, eq(membership.workspaceId, workspace.id))
    .where(eq(membership.userId, userId))
    .orderBy(asc(membership.createdAt));
}

/**
 * Point one session at a workspace the user is a member of. Requests made with that session —
 * page data, API checks and the JWT minted for the intelligence plane — then act within it.
 * Returns null (and changes nothing) when the user isn't a member.
 */
export async function setSessionWorkspace(
  sessionId: string,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  const [target] = await db
    .select({ id: workspace.id, name: workspace.name, role: membership.role })
    .from(membership)
    .innerJoin(workspace, eq(membership.workspaceId, workspace.id))
    .where(and(eq(membership.userId, userId), eq(membership.workspaceId, workspaceId)))
    .limit(1);
  if (!target) return null;
  await db
    .update(session)
    .set({ activeWorkspaceId: workspaceId, updatedAt: new Date() })
    .where(and(eq(session.id, sessionId), eq(session.userId, userId)));
  return target;
}
