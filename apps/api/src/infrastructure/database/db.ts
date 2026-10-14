import { drizzle } from "drizzle-orm/postgres-js";
import { pgClient } from "@cue-memory/db/client";
import * as schema from "@cue-memory/db/schema";
import type { Database } from "./Database";

/**
 * The database package's tables over the shared Postgres connection. In its own
 * module, imported only by the container, because importing it validates
 * `DATABASE_URL`, which tests don't need.
 */
export const db: Database = drizzle(pgClient, { schema });
