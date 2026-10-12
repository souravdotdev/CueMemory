import { describe, expect, it, vi } from "vitest";
import type { SessionResolver, User } from "../../domain";
import { resolveSignedInUser } from "./resolve-signed-in-user";

// An active User; each test overrides only what it's about.
const user = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  name: "Sourav Sanjay",
  email: "sourav@example.com",
  profileImg: null,
  deletedAt: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  ...overrides,
});

const sessionsReturning = (found: User | null): SessionResolver => ({
  resolve: vi.fn(async () => found),
});

const headers = new Headers({ cookie: "better-auth.session_token=abc" });

describe("resolveSignedInUser", () => {
  it("is the Session's User when they're active", async () => {
    const active = user();
    const sessions = sessionsReturning(active);

    await expect(resolveSignedInUser({ sessions }, { headers })).resolves.toBe(active);
    expect(sessions.resolve).toHaveBeenCalledWith(headers);
  });

  it("is nobody when the request carries no valid Session", async () => {
    await expect(
      resolveSignedInUser({ sessions: sessionsReturning(null) }, { headers }),
    ).resolves.toBeNull();
  });

  it("is nobody when the Session belongs to a deleted User", async () => {
    const deleted = user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") });

    await expect(
      resolveSignedInUser({ sessions: sessionsReturning(deleted) }, { headers }),
    ).resolves.toBeNull();
  });
});
