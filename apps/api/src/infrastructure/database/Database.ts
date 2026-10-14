import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@cue-memory/db/schema";

/** A Drizzle handle over the database package's tables: what the repositories take. */
export type Database = PostgresJsDatabase<typeof schema>;
