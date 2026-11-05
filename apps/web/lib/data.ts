import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  aiGeneration,
  comment,
  conversation,
  db,
  document,
  documentVersion,
  membership,
  mention,
  message,
  type Role,
  user,
} from "@vayu/db";
import { extractText } from "./doc-text";

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

export interface DocumentPatch {
  title?: unknown;
  content?: unknown;
  contentText?: unknown;
}

/** Update only the editable fields (never workspace, author, archive or version columns).
 *  Returns false when no document with that id exists in the workspace. */
export async function updateDocument(
  id: string,
  workspaceId: string,
  patch: DocumentPatch,
): Promise<boolean> {
  const set: Partial<typeof document.$inferInsert> = { updatedAt: new Date() };
  if (typeof patch.title === "string") set.title = patch.title.trim().slice(0, 300) || "Untitled";
  if (patch.content && typeof patch.content === "object" && !Array.isArray(patch.content)) {
    set.content = patch.content as Record<string, unknown>;
  }
  if (typeof patch.contentText === "string") set.contentText = patch.contentText;
  const rows = await db
    .update(document)
    .set(set)
    .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
    .returning({ id: document.id });
  return rows.length > 0;
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

/** Resolve/reopen a comment of `documentId`; false when it doesn't belong to that document. */
export async function setCommentResolved(
  id: string,
  documentId: string,
  resolved: boolean,
): Promise<boolean> {
  const rows = await db
    .update(comment)
    .set({ resolved, updatedAt: new Date() })
    .where(and(eq(comment.id, id), eq(comment.documentId, documentId)))
    .returning({ id: comment.id });
  return rows.length > 0;
}

/** The subset of `userIds` that are members of the workspace (mentions can't reach outsiders). */
export async function filterMemberIds(workspaceId: string, userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, userIds)));
  return rows.map((r) => r.userId);
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

export async function getMemberRole(workspaceId: string, userId: string): Promise<Role | null> {
  const [row] = await db
    .select({ role: membership.role })
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, userId)))
    .limit(1);
  return row?.role ?? null;
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
    .where(eq(user.email, email.trim().toLowerCase()))
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

/** Snapshot the document's saved content. The version number is claimed with one atomic
 *  increment, so concurrent snapshots (a double-click) can't collide on the unique key. */
export async function createVersion(
  documentId: string,
  workspaceId: string,
  userId: string,
  summary?: string,
) {
  const [claimed] = await db
    .update(document)
    .set({ currentVersion: sql`${document.currentVersion} + 1` })
    .where(and(eq(document.id, documentId), eq(document.workspaceId, workspaceId)))
    .returning({ version: sql<number>`${document.currentVersion} - 1`, content: document.content });
  if (!claimed) return null;
  const version = Number(claimed.version);
  await db.insert(documentVersion).values({
    documentId,
    version,
    content: claimed.content,
    summary: summary ?? `Snapshot v${version}`,
    createdBy: userId,
  });
  return { version };
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

/** Restore a snapshot of a document in the caller's workspace. The current saved content is
 *  snapshotted first, so a restore never destroys work. */
export async function restoreVersion(
  documentId: string,
  workspaceId: string,
  userId: string,
  version: number,
) {
  if (!(await getDocument(documentId, workspaceId))) return null;
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
  const backup = await createVersion(documentId, workspaceId, userId, `Before restoring v${version}`);
  await db
    .update(document)
    .set({
      content: snapshot.content,
      contentText: extractText(snapshot.content),
      updatedAt: new Date(),
    })
    .where(and(eq(document.id, documentId), eq(document.workspaceId, workspaceId)));
  return { content: snapshot.content, backupVersion: backup?.version ?? null };
}

/* ------------------------------ conversations ----------------------------- */

export async function createConversation(
  workspaceId: string,
  userId: string,
  title?: string,
  agentType?: string | null,
) {
  const [row] = await db
    .insert(conversation)
    .values({
      workspaceId,
      userId,
      title: title || "New conversation",
      agentType: agentType ?? null,
    })
    .returning({ id: conversation.id });
  return row;
}

export async function listConversations(workspaceId: string, userId: string) {
  return db
    .select({
      id: conversation.id,
      title: conversation.title,
      agentType: conversation.agentType,
      updatedAt: conversation.updatedAt,
    })
    .from(conversation)
    .where(
      and(
        eq(conversation.workspaceId, workspaceId),
        eq(conversation.userId, userId),
      ),
    )
    .orderBy(desc(conversation.updatedAt))
    .limit(100);
}

/** A conversation belongs to one user: colleagues in the same workspace can't read it. */
export async function getConversation(id: string, workspaceId: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, id),
        eq(conversation.workspaceId, workspaceId),
        eq(conversation.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listMessages(conversationId: string) {
  return db
    .select({
      id: message.id,
      role: message.role,
      content: message.content,
      provider: message.provider,
      model: message.model,
      tokens: message.tokens,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(message.createdAt)
    .limit(500);
}

export async function appendMessage(
  conversationId: string,
  role: string,
  content: string,
  extra?: { provider?: string; model?: string; tokens?: number },
) {
  const [row] = await db
    .insert(message)
    .values({
      conversationId,
      role,
      content,
      provider: extra?.provider ?? null,
      model: extra?.model ?? null,
      tokens: extra?.tokens ?? 0,
    })
    .returning({ id: message.id });
  await db
    .update(conversation)
    .set({ updatedAt: new Date() })
    .where(eq(conversation.id, conversationId));
  return row;
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
