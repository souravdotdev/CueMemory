import { z } from "zod";

export interface SupabaseStorageEnv {
  url: string;
  serviceRoleKey: string;
}

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

/**
 * Supabase Storage's settings from the environment, or null when either is
 * missing (or empty): the worker then runs without Thumbnails. Both set but
 * malformed is a mistake, so it throws at startup instead.
 */
export function supabaseStorageEnv(env: NodeJS.ProcessEnv): SupabaseStorageEnv | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables in the worker:\n${issues}`);
  }
  return {
    url: parsed.data.SUPABASE_URL,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}
