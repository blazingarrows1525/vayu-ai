import {
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { document } from "./documents";
import { aiGenerationStatusEnum } from "./enums";
import { workspace } from "./workspaces";

/** Copilot usage ledger — powers analytics, spend caps, and idempotency. */
export const aiGeneration = pgTable(
  "ai_generation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => document.id, {
      onDelete: "set null",
    }),
    command: text("command").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: aiGenerationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_generation_workspace_idx").on(t.workspaceId),
    index("ai_generation_user_idx").on(t.userId),
  ],
);
