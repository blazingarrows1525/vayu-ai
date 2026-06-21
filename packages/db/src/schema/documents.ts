import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { folder, tag, workspace } from "./workspaces";

/** Canonical Tiptap/ProseMirror JSON document — the editable unit. */
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folder.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("Untitled"),
    icon: text("icon"),
    coverImage: text("cover_image"),
    content: jsonb("content")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({ type: "doc", content: [] }),
    /** Flattened text, kept in sync for Postgres full-text search. */
    contentText: text("content_text").notNull().default(""),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    isArchived: boolean("is_archived").notNull().default(false),
    isTemplate: boolean("is_template").notNull().default(false),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("document_workspace_idx").on(t.workspaceId),
    index("document_folder_idx").on(t.folderId),
  ],
);

/** Immutable snapshots — Git-for-docs. Snapshot + diff => O(1) restore. */
export const documentVersion = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    summary: text("summary"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("document_version_uq").on(t.documentId, t.version)],
);

/** Denormalized block index for block-level comments, backlinks, search. */
export const documentBlock = pgTable(
  "document_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    blockId: text("block_id").notNull(),
    type: text("type").notNull(),
    text: text("text").notNull().default(""),
    position: integer("position").notNull().default(0),
    parentBlockId: uuid("parent_block_id").references(
      (): AnyPgColumn => documentBlock.id,
      { onDelete: "cascade" },
    ),
  },
  (t) => [index("document_block_doc_idx").on(t.documentId)],
);

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    blockId: text("block_id"),
    parentId: uuid("parent_id").references((): AnyPgColumn => comment.id, {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("comment_document_idx").on(t.documentId)],
);

export const mention = pgTable("mention", {
  id: uuid("id").primaryKey().defaultRandom(),
  commentId: uuid("comment_id").references(() => comment.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => document.id, {
    onDelete: "cascade",
  }),
  mentionedUserId: uuid("mentioned_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentTag = pgTable(
  "document_tag",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.tagId] })],
);
