import { findMigrationsFolder, runMigrations } from "@vayu/db/migrate";

/**
 * Bring the product schema up to date before serving. Nothing else applies migrations in a
 * deployed environment, so without this a fresh database has no auth tables and sign-in fails.
 * Idempotent; a failure is logged loudly but doesn't stop pages that don't need the DB.
 */
export async function migrateDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const folder = findMigrationsFolder();
  if (!folder) {
    console.error("[migrate] migrations folder not found — set DRIZZLE_MIGRATIONS_DIR");
    return;
  }
  try {
    const { applied, skippedStatements } = await runMigrations(folder, url);
    console.log(
      applied
        ? `[migrate] applied ${applied} migration(s)` +
            (skippedStatements ? ` (${skippedStatements} already-existing objects skipped)` : "")
        : "[migrate] database schema is up to date",
    );
  } catch (err) {
    console.error("[migrate] FAILED — the database schema may be incomplete:", err);
  }
}
