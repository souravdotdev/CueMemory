import postgres from "postgres";
import { dbEnv } from "./env";

/** Raw Postgres connection — no Drizzle schema bound here. Each feature package wraps this in its own `drizzle(pgClient, { schema })` call. */
export const pgClient = postgres(dbEnv.DATABASE_URL);
