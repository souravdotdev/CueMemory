import { defineConfig } from "drizzle-kit";
import { dbEnv } from "@second-brain/shared-kernel/db";

export default defineConfig({
  schema: "./schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbEnv.DATABASE_URL,
  },
});
