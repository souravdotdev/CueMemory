import { describe, expect, it } from "vitest";
import { toUser } from "./user-mappers";

type UserRow = Parameters<typeof toUser>[0];

// An active User row with a Google avatar; each test overrides only what it's about.
const row = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: "user-1",
  name: "Sourav Sanjay",
  email: "sourav@example.com",
  emailVerified: true,
  image: "https://example.com/avatar.png",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

describe("toUser", () => {
  it("maps an active User with a null deletedAt and a date createdAt, renaming image to profileImg and dropping better-auth internals", () => {
    expect(toUser(row())).toEqual({
      id: "user-1",
      name: "Sourav Sanjay",
      email: "sourav@example.com",
      profileImg: "https://example.com/avatar.png",
      deletedAt: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("maps a deleted User carrying its deletedAt as a date", () => {
    const user = toUser(row({ deletedAt: new Date("2026-05-10T12:30:00.000Z") }));

    expect(user.deletedAt).toEqual(new Date("2026-05-10T12:30:00.000Z"));
  });

  it("maps a User without a Google avatar to a null profileImg", () => {
    const user = toUser(row({ image: null }));

    expect(user.profileImg).toBeNull();
  });
});
