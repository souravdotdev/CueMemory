import { describe, expect, it } from "vitest";
import { googleProfileFromIdToken } from "./google-profile";

// An unsigned JWT with the given claims: the profile is read, not verified, because
// Better Auth received this token from Google itself moments earlier.
const idToken = (claims: Record<string, unknown>) =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

describe("googleProfileFromIdToken", () => {
  it("reads the Display name and avatar from Google's claims", () => {
    const token = idToken({
      sub: "123",
      email: "someone@gmail.com",
      name: "Sourav Sanjay",
      picture: "https://lh3.googleusercontent.com/a/avatar",
    });

    expect(googleProfileFromIdToken(token)).toEqual({
      name: "Sourav Sanjay",
      profileImg: "https://lh3.googleusercontent.com/a/avatar",
    });
  });

  it("gives no avatar for a Google account without a photo", () => {
    expect(googleProfileFromIdToken(idToken({ name: "No Photo" })).profileImg).toBeNull();
  });

  it("gives no Display name when Google sends none", () => {
    expect(googleProfileFromIdToken(idToken({})).name).toBeNull();
  });

  it("refuses something that isn't a JWT", () => {
    expect(() => googleProfileFromIdToken("not-a-jwt")).toThrow();
  });
});
