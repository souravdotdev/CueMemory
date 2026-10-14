import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { AdmitSignInUseCase } from "@/application/use-cases/auth/AdmitSignInUseCase";
import type { User } from "@/domain/entities/User";
import { NotFoundError, UserPermanentlyDeletedError } from "@/domain/errors";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-06-01T12:00:00.000Z");

// An active User as stored; each test overrides only what it's about.
const user = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  name: "Old Name",
  email: "signed-up@example.com",
  profileImg: "https://lh3.googleusercontent.com/a/old",
  deletedAt: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  ...overrides,
});

const usersHolding = (stored: User | null): IUserRepository => ({
  findById: vi.fn(async () => stored),
  recordSignIn: vi.fn(async () => {}),
});

// What Google says about the User right now.
const profile = { name: "New Name", profileImg: "https://lh3.googleusercontent.com/a/new" };

describe("AdmitSignInUseCase", () => {
  it("refreshes an active User's Display name and avatar from Google", async () => {
    const users = usersHolding(user());

    await new AdmitSignInUseCase(users).execute({ userId: "user-1", profile, now });

    expect(users.recordSignIn).toHaveBeenCalledWith("user-1", {
      name: "New Name",
      profileImg: "https://lh3.googleusercontent.com/a/new",
    });
  });

  it("restores a User deleted within the Grace period, refreshing their profile too", async () => {
    const users = usersHolding(user({ deletedAt: new Date(now.getTime() - DAY) }));

    await new AdmitSignInUseCase(users).execute({ userId: "user-1", profile, now });

    expect(users.recordSignIn).toHaveBeenCalledWith("user-1", {
      name: "New Name",
      profileImg: "https://lh3.googleusercontent.com/a/new",
      deletedAt: null,
    });
  });

  it("refuses a User deleted longer ago than the Grace period, changing nothing", async () => {
    const users = usersHolding(user({ deletedAt: new Date(now.getTime() - 31 * DAY) }));

    await expect(
      new AdmitSignInUseCase(users).execute({ userId: "user-1", profile, now }),
    ).rejects.toBeInstanceOf(UserPermanentlyDeletedError);
    expect(users.recordSignIn).not.toHaveBeenCalled();
  });

  it("clears the avatar when the User no longer has a Google photo", async () => {
    const users = usersHolding(user());

    await new AdmitSignInUseCase(users).execute({
      userId: "user-1",
      profile: { ...profile, profileImg: null },
      now,
    });

    expect(users.recordSignIn).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ profileImg: null }),
    );
  });

  it("keeps the current Display name when Google sends none", async () => {
    const users = usersHolding(user());

    await new AdmitSignInUseCase(users).execute({
      userId: "user-1",
      profile: { ...profile, name: null },
      now,
    });

    expect(users.recordSignIn).toHaveBeenCalledWith("user-1", {
      profileImg: "https://lh3.googleusercontent.com/a/new",
    });
  });

  it("never changes the email captured at sign-up", async () => {
    const users = usersHolding(user());

    await new AdmitSignInUseCase(users).execute({ userId: "user-1", profile, now });

    expect(vi.mocked(users.recordSignIn).mock.calls[0]![1]).not.toHaveProperty("email");
  });

  it("fails with NotFoundError when the signing-in User doesn't exist", async () => {
    const admitting = new AdmitSignInUseCase(usersHolding(null)).execute({
      userId: "user-1",
      profile,
      now,
    });

    await expect(admitting).rejects.toBeInstanceOf(NotFoundError);
    await expect(admitting).rejects.toThrow("user-1");
  });
});
