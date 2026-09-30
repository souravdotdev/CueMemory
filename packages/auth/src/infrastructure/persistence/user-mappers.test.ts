import { describe, expect, it } from "vitest";
import { toUser } from "./user-mappers";

describe("toUser", () => {
  it("maps an active User with a null deletedAt, renaming image to profileImg and dropping better-auth internals", () => {
    const user = toUser({
      id: "user-1",
      name: "Sourav Sanjay",
      email: "sourav@example.com",
      emailVerified: true,
      image: "https://example.com/avatar.png",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      deletedAt: null,
    });

    expect(user).toEqual({
      id: "user-1",
      name: "Sourav Sanjay",
      email: "sourav@example.com",
      profileImg: "https://example.com/avatar.png",
      deletedAt: null,
      createdAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("converts a deleted User's deletedAt to an ISO string", () => {
    const user = toUser({
      id: "user-2",
      name: "Deleted User",
      email: "deleted@example.com",
      emailVerified: true,
      image: "https://example.com/avatar.png",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-10T12:30:00.000Z"),
      deletedAt: new Date("2026-05-10T12:30:00.000Z"),
    });

    expect(user.deletedAt).toBe("2026-05-10T12:30:00.000Z");
  });

  it("maps a User without a Google avatar to a null profileImg", () => {
    const user = toUser({
      id: "user-3",
      name: "No Avatar",
      email: "no-avatar@example.com",
      emailVerified: false,
      image: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      deletedAt: null,
    });

    expect(user.profileImg).toBeNull();
  });
});
