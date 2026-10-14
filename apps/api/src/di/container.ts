import "reflect-metadata";
import { Container } from "inversify";
import type { Redis } from "ioredis";
import {
  BetterAuthSessionResolver,
  createAuth,
  DrizzleUserRepository,
  type AuthDatabase,
  type SessionResolver,
  type UserRepository,
} from "@cue-memory/auth";
import { db } from "@cue-memory/auth/database";
import { TOKENS } from "@/di/tokens";
import { env, type Env } from "@/env";
import { rateLimitRedis } from "@/rate-limit-redis";

type Auth = ReturnType<typeof createAuth>;

/**
 * The production container: the only place concrete classes are built and
 * bound to their tokens. Everything is a singleton for the process's life.
 */
export function createContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<Env>(TOKENS.Env).toConstantValue(env);
  container.bind<AuthDatabase>(TOKENS.Database).toConstantValue(db);
  container.bind<Redis>(TOKENS.RateLimitRedis).toConstantValue(rateLimitRedis);

  container
    .bind<UserRepository>(TOKENS.UserRepository)
    .toDynamicValue((context) => new DrizzleUserRepository(context.get(TOKENS.Database)));

  container.bind<Auth>(TOKENS.Auth).toDynamicValue((context) => {
    const config = context.get<Env>(TOKENS.Env);
    return createAuth(
      context.get(TOKENS.Database),
      {
        secret: config.BETTER_AUTH_SECRET,
        baseURL: config.BETTER_AUTH_URL,
        webOrigin: config.WEB_ORIGIN,
        google: { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET },
        cookieDomain: config.AUTH_COOKIE_DOMAIN,
      },
      { users: context.get(TOKENS.UserRepository) },
    );
  });

  container
    .bind<SessionResolver>(TOKENS.SessionResolver)
    .toDynamicValue((context) => new BetterAuthSessionResolver(context.get<Auth>(TOKENS.Auth).api));

  return container;
}
