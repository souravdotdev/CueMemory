import "reflect-metadata";
import { Container } from "inversify";
import type { Redis } from "ioredis";
import {
  createAuth,
  DrizzleUserRepository,
  type AuthDatabase,
  type UserRepository,
} from "@cue-memory/auth";
import { db } from "@cue-memory/auth/database";
import { GetMeUseCase } from "@/application/use-cases/auth/GetMeUseCase";
import { ResolveSignedInUserUseCase } from "@/application/use-cases/auth/ResolveSignedInUserUseCase";
import { TOKENS } from "@/di/tokens";
import type { ISessionProvider } from "@/domain/providers/ISessionProvider";
import { env, type Env } from "@/env";
import {
  BetterAuthSessionProvider,
  type SessionApi,
} from "@/infrastructure/auth/BetterAuthSessionProvider";
import { MeController } from "@/interface/controllers/MeController";
import { rateLimitRedis } from "@/rate-limit-redis";

type Auth = ReturnType<typeof createAuth>;

/**
 * The production container: the only place concrete classes are built and
 * bound to their tokens. Infrastructure and controllers are singletons for the
 * process's life; use cases are built fresh each time they're asked for.
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
      // BetterAuthSessionProvider takes this instance for its get-session.
    ) satisfies { api: SessionApi };
  });

  container
    .bind<ISessionProvider>(TOKENS.SessionProvider)
    .to(BetterAuthSessionProvider)
    .inSingletonScope();

  container
    .bind(TOKENS.ResolveSignedInUserUseCase)
    .to(ResolveSignedInUserUseCase)
    .inTransientScope();
  container.bind(TOKENS.GetMeUseCase).to(GetMeUseCase).inTransientScope();

  container.bind(TOKENS.MeController).to(MeController).inSingletonScope();

  return container;
}
