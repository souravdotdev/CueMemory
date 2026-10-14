import postgres from "postgres";
import { dbEnv } from "./env";

/** Raw Postgres connection — no Drizzle schema bound here. The API wraps this in one `drizzle(pgClient, { schema })` instance. */
export const pgClient = postgres(dbEnv.DATABASE_URL);
