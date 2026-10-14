import { defineConfig } from "drizzle-kit";
import { dbEnv } from "@cue-memory/db/client";

export default defineConfig({
  // The feature packages' schema barrels, by path: they depend on this
  // package for the Postgres client, so this package can't depend back on
  // them to re-export their tables.
  schema: [
    "../auth/src/infrastructure/persistence/schema/index.ts",
    "../items/src/infrastructure/persistence/schema/index.ts",
  ],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbEnv.DATABASE_URL,
  },
});
