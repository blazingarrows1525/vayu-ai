import { and, desc, eq } from "drizzle-orm";
import {
  aiGeneration,
  comment,
  db,
  document,
  documentVersion,
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

/* --------------------------- versions + analytics ------------------------- */

export async function createVersion(
  documentId: string,
  workspaceId: string,
  userId: string,
) {
  const doc = await getDocument(documentId, workspaceId);
  if (!doc) return null;
  await db.insert(documentVersion).values({
    documentId,
    version: doc.currentVersion,
    content: doc.content,
    summary: `Snapshot v${doc.currentVersion}`,
    createdBy: userId,
  });
  await db
    .update(document)
    .set({ currentVersion: doc.currentVersion + 1 })
    .where(eq(document.id, documentId));
  return { version: doc.currentVersion };
}

export async function listVersions(documentId: string) {
  return db
    .select({
      version: documentVersion.version,
      summary: documentVersion.summary,
      createdAt: documentVersion.createdAt,
    })
    .from(documentVersion)
    .where(eq(documentVersion.documentId, documentId))
    .orderBy(desc(documentVersion.version))
    .limit(100);
}

export async function restoreVersion(
  documentId: string,
  workspaceId: string,
  version: number,
) {
  const [snapshot] = await db
    .select({ content: documentVersion.content })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, documentId),
        eq(documentVersion.version, version),
      ),
    )
    .limit(1);
  if (!snapshot) return null;
  await db
    .update(document)
    .set({ content: snapshot.content, updatedAt: new Date() })
    .where(and(eq(document.id, documentId), eq(document.workspaceId, workspaceId)));
  return { content: snapshot.content };
}

export async function getAnalytics(workspaceId: string) {
  const docs = await db
    .select({ contentText: document.contentText, updatedAt: document.updatedAt })
    .from(document)
    .where(
      and(eq(document.workspaceId, workspaceId), eq(document.isArchived, false)),
    );

  let words = 0;
  for (const d of docs) {
    const text = (d.contentText ?? "").trim();
    if (text) words += text.split(/\s+/).length;
  }
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recentlyEdited = docs.filter(
    (d) => new Date(d.updatedAt).getTime() > weekAgo,
  ).length;

  const gens = await db
    .select({
      promptTokens: aiGeneration.promptTokens,
      completionTokens: aiGeneration.completionTokens,
      costUsd: aiGeneration.costUsd,
    })
    .from(aiGeneration)
    .where(eq(aiGeneration.workspaceId, workspaceId))
    .limit(5000);

  const aiTokens = gens.reduce(
    (n, g) => n + g.promptTokens + g.completionTokens,
    0,
  );
  const aiCostUsd = Math.round(gens.reduce((n, g) => n + g.costUsd, 0) * 1e4) / 1e4;

  return {
    documents: docs.length,
    words,
    readingMinutes: Math.ceil(words / 200),
    recentlyEdited,
    aiGenerations: gens.length,
    aiTokens,
    aiCostUsd,
  };
}
