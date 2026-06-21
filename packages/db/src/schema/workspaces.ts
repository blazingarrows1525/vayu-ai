import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { roleEnum, workspacePlanEnum } from "./enums";

/** A tenant boundary. Every domain row hangs off a workspace_id. */
export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  plan: workspacePlanEnum("plan").notNull().default("free"),
  settings: jsonb("settings")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** user ↔ workspace with a role. The heart of RBAC. */
export const membership = pgTable(
  "membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("viewer"),
    invitedBy: uuid("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("membership_workspace_user_uq").on(t.workspaceId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

export const folder = pgTable(
  "folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folder.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("folder_workspace_idx").on(t.workspaceId)],
);

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("tag_workspace_name_uq").on(t.workspaceId, t.name)],
);
