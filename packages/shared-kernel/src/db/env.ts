import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables in @cue-memory/shared-kernel:\n${issues}`);
}

export const dbEnv = parsed.data;
