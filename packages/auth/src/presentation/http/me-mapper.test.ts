import { meResponseDtoSchema } from "@cue-memory/shared/auth";
import { describe, expect, it } from "vitest";
import type { User } from "../../domain";
import { toMeResponseDto } from "./me-mapper";

// An active User with a Google avatar; each test overrides only what it's about.
const user = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  name: "Sourav Sanjay",
  email: "sourav@example.com",
  profileImg: "https://lh3.googleusercontent.com/a/avatar",
  deletedAt: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  ...overrides,
});

describe("toMeResponseDto", () => {
  it("maps the User's display name, avatar and ISO created time", () => {
    expect(toMeResponseDto(user())).toEqual({
      id: "user-1",
      displayName: "Sourav Sanjay",
      email: "sourav@example.com",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("maps a User without a Google avatar to a null avatar URL", () => {
    expect(toMeResponseDto(user({ profileImg: null })).avatarUrl).toBeNull();
  });

  it("never exposes the deletion time, and fits the me contract", () => {
    const dto = toMeResponseDto(user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") }));

    expect(dto).not.toHaveProperty("deletedAt");
    expect(meResponseDtoSchema.parse(dto)).toEqual(dto);
  });
});
