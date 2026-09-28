import { describe, expect, it } from "vitest";
import { toUser } from "./user-mappers";

describe("toUser", () => {
  it("converts createdAt to an ISO string and renames image to profileImg, dropping better-auth internals", () => {
    const user = toUser({
      id: "user-1",
      email: "sourav@example.com",
      emailVerified: true,
      name: "Sourav Sanjay",
      firstName: "Sourav",
      lastName: "Sanjay",
      image: "https://example.com/avatar.png",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(user).toEqual({
      id: "user-1",
      email: "sourav@example.com",
      firstName: "Sourav",
      lastName: "Sanjay",
      profileImg: "https://example.com/avatar.png",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
  });
});
