import { createAuth } from "@cue-memory/auth";
import { db } from "@cue-memory/auth/database";
import { env } from "./env";

export const auth = createAuth(db, {
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  webOrigin: env.WEB_ORIGIN,
  google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  cookieDomain: env.AUTH_COOKIE_DOMAIN,
});
