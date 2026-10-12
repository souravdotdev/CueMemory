import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/** A Drizzle handle over the Auth tables: what `createAuth` and the repositories take. */
export type AuthDatabase = PostgresJsDatabase<typeof schema>;
