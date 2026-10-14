import "reflect-metadata";
import { MeResponseSchema } from "@cue-memory/shared/schemas/auth";
import { describe, expect, it } from "vitest";
import { GetMeUseCase } from "@/application/use-cases/auth/GetMeUseCase";
import type { User } from "@/domain/entities/User";

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

describe("GetMeUseCase", () => {
  it("is the User's display name, avatar and ISO created time", () => {
    expect(new GetMeUseCase().execute(user())).toEqual({
      id: "user-1",
      displayName: "Sourav Sanjay",
      email: "sourav@example.com",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("gives a User without a Google avatar a null avatar URL", () => {
    expect(new GetMeUseCase().execute(user({ profileImg: null })).avatarUrl).toBeNull();
  });

  it("never exposes the deletion time, and fits the me contract", () => {
    const me = new GetMeUseCase().execute(
      user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") }),
    );

    expect(me).not.toHaveProperty("deletedAt");
    expect(MeResponseSchema.parse(me)).toEqual(me);
  });
});
