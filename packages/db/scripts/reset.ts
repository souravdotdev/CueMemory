import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { dbEnv, pgClient } from "@cue-memory/shared-kernel/db";

// Wipes every table, enum, and drizzle's migration bookkeeping so the schema
// can be regenerated from a fresh `0000`. Local databases only.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const { hostname } = new URL(dbEnv.DATABASE_URL);
if (!LOCAL_HOSTS.has(hostname)) {
  await pgClient.end();
  throw new Error(`Refusing to reset non-local database host "${hostname}".`);
}

const db = drizzle(pgClient);

try {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await tx.execute(sql`DROP SCHEMA public CASCADE`);
    await tx.execute(sql`CREATE SCHEMA public`);
  });
  console.log(`Reset ${hostname}: dropped schemas "public" (recreated empty) and "drizzle".`);
} finally {
  await pgClient.end();
}
