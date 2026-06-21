import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspace } from "./workspaces";

/** Security trail for sensitive actions (role changes, deletes, exports…). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspace.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_workspace_idx").on(t.workspaceId)],
);
