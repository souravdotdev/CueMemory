import { drizzle } from "drizzle-orm/postgres-js";
import { pgClient } from "@cue-memory/db/client";
import * as schema from "@cue-memory/db/schema";

/**
 * The database package's tables over the shared Postgres connection. Exported on its own
 * subpath (`@cue-memory/auth/database`), outside the package barrel, because
 * importing it validates `DATABASE_URL`, which tests and type-only consumers
 * of `@cue-memory/auth` shouldn't need.
 */
export const db = drizzle(pgClient, { schema });
