import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for the PRODUCT-plane schema only.
 * The intelligence plane (knowledge_source, embedding, agent_run, agent_step)
 * is owned by apps/ai via Alembic — see docs/architecture/03-data-model.md.
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://vayu:vayu@localhost:5432/vayu",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
