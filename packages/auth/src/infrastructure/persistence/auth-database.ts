import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@cue-memory/db/schema";

/** A Drizzle handle over the database package's tables (Auth's among them): what `createAuth` and the repositories take. */
export type AuthDatabase = PostgresJsDatabase<typeof schema>;
