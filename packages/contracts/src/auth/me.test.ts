import { describe, expect, it } from "vitest";
import { meResponseDtoSchema } from "./index";

const me = {
  id: "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  displayName: "Sourav Sanjay",
  email: "sourav@example.com",
  avatarUrl: "https://lh3.googleusercontent.com/a/avatar",
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("meResponseDtoSchema", () => {
  it("accepts the signed-in User", () => {
    expect(meResponseDtoSchema.parse(me)).toEqual(me);
  });

  it("accepts a User without a Google avatar", () => {
    const withoutAvatar = { ...me, avatarUrl: null };

    expect(meResponseDtoSchema.parse(withoutAvatar)).toEqual(withoutAvatar);
  });

  it("rejects a created time that isn't an ISO timestamp", () => {
    expect(meResponseDtoSchema.safeParse({ ...me, createdAt: "1 April 2026" }).success).toBe(false);
  });

  it("strips internals such as the deletion time", () => {
    const parsed = meResponseDtoSchema.parse({ ...me, deletedAt: null, emailVerified: true });

    expect(parsed).toEqual(me);
  });
});
