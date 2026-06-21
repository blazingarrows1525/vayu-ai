/**
 * @vayu/db — product-plane schema + client.
 *
 * The single source of truth for users, workspaces, documents, and
 * collaboration. The intelligence plane owns its own tables (apps/ai).
 */
export * from "./schema";
export { db, type Database } from "./client";

import type {
  aiGeneration,
  comment,
  document,
  documentVersion,
  membership,
  user,
  workspace,
} from "./schema";

// Convenient row types inferred straight from the schema.
export type User = typeof user.$inferSelect;
export type Workspace = typeof workspace.$inferSelect;
export type Membership = typeof membership.$inferSelect;
export type Role = Membership["role"];
export type Document = typeof document.$inferSelect;
export type NewDocument = typeof document.$inferInsert;
export type DocumentVersion = typeof documentVersion.$inferSelect;
export type Comment = typeof comment.$inferSelect;
export type AiGeneration = typeof aiGeneration.$inferSelect;
