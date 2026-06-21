import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse a single connection pool across hot reloads in dev so we don't exhaust
// Postgres connections on every file change.
const globalForDb = globalThis as unknown as {
  __vayuSql?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__vayuSql ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__vayuSql = client;
}

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;
