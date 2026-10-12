import { describe, expect, it, vi } from "vitest";
import {
  BetterAuthSessionResolver,
  type SessionApi,
  type SessionUser,
} from "./better-auth-session-resolver";

// The User as Better Auth's get-session returns them, read from the users row.
const sessionUser = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  id: "user-1",
  name: "Sourav Sanjay",
  email: "sourav@example.com",
  emailVerified: true,
  image: "https://lh3.googleusercontent.com/a/avatar",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

const apiReturning = (session: { user: SessionUser } | null): SessionApi => ({
  getSession: vi.fn(async () => session),
});

const headers = new Headers({ cookie: "better-auth.session_token=abc" });

describe("BetterAuthSessionResolver", () => {
  it("asks Better Auth for the Session of the request's headers", async () => {
    const api = apiReturning(null);

    await new BetterAuthSessionResolver(api).resolve(headers);

    expect(api.getSession).toHaveBeenCalledWith({ headers });
  });

  it("is null when Better Auth finds no valid Session", async () => {
    await expect(
      new BetterAuthSessionResolver(apiReturning(null)).resolve(headers),
    ).resolves.toBeNull();
  });

  it("is the Session's User as the domain User", async () => {
    const resolver = new BetterAuthSessionResolver(apiReturning({ user: sessionUser() }));

    await expect(resolver.resolve(headers)).resolves.toEqual({
      id: "user-1",
      name: "Sourav Sanjay",
      email: "sourav@example.com",
      profileImg: "https://lh3.googleusercontent.com/a/avatar",
      deletedAt: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("carries a deleted User's deletion time, and a missing avatar as null", async () => {
    const deletedAt = new Date("2026-05-01T00:00:00.000Z");
    const resolver = new BetterAuthSessionResolver(
      apiReturning({ user: sessionUser({ image: undefined, deletedAt }) }),
    );

    await expect(resolver.resolve(headers)).resolves.toMatchObject({ profileImg: null, deletedAt });
  });
});
