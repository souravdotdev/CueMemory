import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ResolveSignedInUserUseCase } from "@/application/use-cases/auth/ResolveSignedInUserUseCase";
import type { User } from "@/domain/entities/User";
import { UnauthorizedError } from "@/domain/errors";
import type { ISessionProvider } from "@/domain/providers/ISessionProvider";

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

const sessionsReturning = (found: User | null): ISessionProvider => ({
  resolve: vi.fn(async () => found),
});

const headers = new Headers({ cookie: "better-auth.session_token=abc" });

describe("ResolveSignedInUserUseCase", () => {
  it("is the Session's User when they're active", async () => {
    const active = user();
    const sessions = sessionsReturning(active);

    await expect(new ResolveSignedInUserUseCase(sessions).execute({ headers })).resolves.toBe(
      active,
    );
    expect(sessions.resolve).toHaveBeenCalledWith(headers);
  });

  it("refuses a request that carries no valid Session", async () => {
    const useCase = new ResolveSignedInUserUseCase(sessionsReturning(null));

    await expect(useCase.execute({ headers })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("refuses a Session that belongs to a deleted User", async () => {
    const deleted = user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") });
    const useCase = new ResolveSignedInUserUseCase(sessionsReturning(deleted));

    await expect(useCase.execute({ headers })).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
