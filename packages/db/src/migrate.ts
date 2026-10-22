import fs from "node:fs";
import path from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

/**
 * Applies the Drizzle migrations in `packages/db/drizzle`, compatible with `drizzle-kit migrate`
 * (same `drizzle.__drizzle_migrations` table, hashes, and "newer than the last applied" rule).
 *
 * One difference: each statement runs in its own savepoint and "already exists" errors are
 * skipped, so a database that was partly built some other way converges instead of aborting.
 */

// duplicate_table (incl. indexes), duplicate_object (types, constraints), duplicate_schema,
// duplicate_column, duplicate_function.
const ALREADY_EXISTS = new Set(["42P07", "42710", "42P06", "42701", "42723"]);
const LOCK_KEY = 7_303_301; // arbitrary; serialises concurrent boots

export function findMigrationsFolder(): string | null {
  const candidates = [
    process.env.DRIZZLE_MIGRATIONS_DIR,
    path.resolve(process.cwd(), "../../packages/db/drizzle"), // apps/web (next start / dev)
    path.resolve(process.cwd(), "packages/db/drizzle"), // repo root
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "meta/_journal.json"))) return dir;
  }
  return null;
}

export async function runMigrations(
  migrationsFolder: string,
  databaseUrl: string,
): Promise<{ applied: number; skippedStatements: number }> {
  const migrations = readMigrationFiles({ migrationsFolder });
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  let applied = 0;
  let skippedStatements = 0;
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
      await tx`CREATE SCHEMA IF NOT EXISTS drizzle`;
      await tx`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
      )`;
      const [last] = await tx`
        select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`;

      for (const migration of migrations) {
        if (last && Number(last.created_at) >= migration.folderMillis) continue;
        for (const statement of migration.sql) {
          if (!statement.trim()) continue;
          try {
            await tx.savepoint((sp) => sp.unsafe(statement));
          } catch (err) {
            const code = (err as { code?: string }).code;
            if (!code || !ALREADY_EXISTS.has(code)) throw err;
            skippedStatements++;
          }
        }
        await tx`insert into drizzle.__drizzle_migrations (hash, created_at)
                 values (${migration.hash}, ${migration.folderMillis})`;
        applied++;
      }
    });
  } finally {
    await sql.end();
  }
  return { applied, skippedStatements };
}
