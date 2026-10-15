import { z } from "zod";

// zod's plain url() also accepts "localhost:4000" (as a "localhost:" scheme).
const httpUrl = z.url({ protocol: /^https?$/ });

// CORS and Better Auth compare origins exactly, so a trailing slash or a path
// would silently lock the web app out.
const origin = httpUrl.refine((value) => URL.canParse(value) && new URL(value).origin === value, {
  message: "Must be a bare origin, such as https://app.example.com (no path or trailing slash)",
});

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  // The interface the server binds to. 0.0.0.0 (every interface) suits containers and hosts;
  // set 127.0.0.1 locally so only this machine can reach the dev server.
  HOST: z.string().min(1).default("0.0.0.0"),
  // Signs and encrypts Sessions and OAuth tokens. Generate with `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: z.string().min(32),
  // The API's own public URL; Google redirects back to `${BETTER_AUTH_URL}/api/auth/callback/google`.
  BETTER_AUTH_URL: httpUrl,
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // The web app's origin: the only one CORS and Better Auth trust.
  WEB_ORIGIN: origin,
  // The parent domain web and API share in production (e.g. `cuememory.app`); unset locally.
  AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables in api:\n${issues}`);
}

export const env = parsed.data;
