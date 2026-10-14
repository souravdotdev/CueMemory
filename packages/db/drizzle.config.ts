import { defineConfig } from "drizzle-kit";
import { dbEnv } from "@cue-memory/db/client";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbEnv.DATABASE_URL,
  },
});
