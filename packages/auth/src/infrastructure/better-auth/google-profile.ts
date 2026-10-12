import type { SignInProfile } from "../../domain";

/**
 * The Display name and avatar from a Google ID token's claims: the same profile
 * Better Auth's Google provider reads at sign-in. Decoded without verifying the
 * signature, because Better Auth stored this token straight from Google's token
 * endpoint during the sign-in now under way.
 */
export function googleProfileFromIdToken(idToken: string): SignInProfile {
  const payload = idToken.split(".")[1];
  if (payload === undefined) throw new Error("Google ID token isn't a JWT");

  const claims: { name?: unknown; picture?: unknown } = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  );
  return {
    name: typeof claims.name === "string" && claims.name !== "" ? claims.name : null,
    profileImg: typeof claims.picture === "string" ? claims.picture : null,
  };
}
