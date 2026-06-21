import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, membership, type Role, workspace } from "@vayu/db";

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
 * Resolve the workspace + role to stamp into the JWT. Prefers an explicitly
 * active workspace, otherwise the user's first (personal) workspace.
 * Active-workspace switching is wired in Phase 9.
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
