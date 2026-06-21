import { pgEnum } from "drizzle-orm/pg-core";

/** RBAC roles, ordered most → least privileged. */
export const roleEnum = pgEnum("role", ["owner", "admin", "editor", "viewer"]);

export const workspacePlanEnum = pgEnum("workspace_plan", [
  "free",
  "pro",
  "enterprise",
]);

export const aiGenerationStatusEnum = pgEnum("ai_generation_status", [
  "pending",
  "streaming",
  "completed",
  "failed",
]);
