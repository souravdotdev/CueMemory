import { z } from "zod";

export interface SupabaseStorageEnv {
  url: string;
  serviceRoleKey: string;
}

// An optional setting whose empty value (`SUPABASE_URL=` in a .env file) counts as unset.
const unsetWhenEmpty = <T extends z.ZodType>(value: T) =>
  z.preprocess((raw) => (raw === "" ? undefined : raw), value.optional());

// The same rules as the API's env.ts. zod's plain url() also accepts "localhost:54321".
const schema = z.object({
  SUPABASE_URL: unsetWhenEmpty(z.url({ protocol: /^https?$/ })),
  SUPABASE_SERVICE_ROLE_KEY: unsetWhenEmpty(z.string()),
});

/**
 * Supabase Storage's settings from the environment, or null when either is
 * unset (or empty): the worker then runs without Thumbnails. A URL that is set
 * but isn't an http(s) one is a mistake, so it throws at startup instead.
 */
export function supabaseStorageEnv(env: NodeJS.ProcessEnv): SupabaseStorageEnv | null {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables in the worker:\n${issues}`);
  }
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = parsed.data;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}
