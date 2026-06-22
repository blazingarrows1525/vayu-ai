import { and, desc, eq } from "drizzle-orm";
import {
  comment,
  db,
  document,
  membership,
  mention,
  type Role,
  user,
} from "@vayu/db";

/* ------------------------------- documents ------------------------------- */

export async function listDocuments(workspaceId: string) {
  return db
    .select({
      id: document.id,
      title: document.title,
      icon: document.icon,
      updatedAt: document.updatedAt,
    })
    .from(document)
    .where(
      and(eq(document.workspaceId, workspaceId), eq(document.isArchived, false)),
    )
    .orderBy(desc(document.updatedAt))
    .limit(200);
}

export async function createDocument(
  workspaceId: string,
  createdBy: string,
  title: string,
) {
  const [row] = await db
    .insert(document)
    .values({ workspaceId, createdBy, title: title || "Untitled" })
    .returning({ id: document.id });
  return row;
}

export async function getDocument(id: string, workspaceId: string) {
  const [row] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function updateDocument(
  id: string,
  workspaceId: string,
  patch: { title?: string; content?: Record<string, unknown>; contentText?: string },
) {
  await db
    .update(document)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)));
}

/* -------------------------------- comments -------------------------------- */

export async function listComments(documentId: string) {
  return db
    .select({
      id: comment.id,
      body: comment.body,
      resolved: comment.resolved,
      blockId: comment.blockId,
      authorId: comment.authorId,
      authorName: user.name,
      createdAt: comment.createdAt,
    })
    .from(comment)
    .innerJoin(user, eq(comment.authorId, user.id))
    .where(eq(comment.documentId, documentId))
    .orderBy(desc(comment.createdAt));
}

export async function createComment(
  documentId: string,
  authorId: string,
  body: string,
  blockId: string | null,
  mentions: string[],
) {
  const [row] = await db
    .insert(comment)
    .values({ documentId, authorId, body, blockId })
    .returning({ id: comment.id });
  if (row && mentions.length > 0) {
    await db.insert(mention).values(
      mentions.map((mentionedUserId) => ({
        commentId: row.id,
        documentId,
        mentionedUserId,
      })),
    );
  }
  return row;
}

export async function setCommentResolved(id: string, resolved: boolean) {
  await db
    .update(comment)
    .set({ resolved, updatedAt: new Date() })
    .where(eq(comment.id, id));
}

/* -------------------------------- members --------------------------------- */

export async function listMembers(workspaceId: string) {
  return db
    .select({
      userId: membership.userId,
      role: membership.role,
      name: user.name,
      email: user.email,
    })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .where(eq(membership.workspaceId, workspaceId));
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: Role,
  invitedBy: string,
) {
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!found) return { ok: false as const, reason: "no_such_user" };

  const [existing] = await db
    .select({ id: membership.id })
    .from(membership)
    .where(
      and(
        eq(membership.workspaceId, workspaceId),
        eq(membership.userId, found.id),
      ),
    )
    .limit(1);
  if (existing) return { ok: false as const, reason: "already_member" };

  await db
    .insert(membership)
    .values({ workspaceId, userId: found.id, role, invitedBy });
  return { ok: true as const };
}

export async function setMemberRole(
  workspaceId: string,
  userId: string,
  role: Role,
) {
  await db
    .update(membership)
    .set({ role })
    .where(
      and(
        eq(membership.workspaceId, workspaceId),
        eq(membership.userId, userId),
      ),
    );
}

export async function removeMember(workspaceId: string, userId: string) {
  await db
    .delete(membership)
    .where(
      and(
        eq(membership.workspaceId, workspaceId),
        eq(membership.userId, userId),
      ),
    );
}
