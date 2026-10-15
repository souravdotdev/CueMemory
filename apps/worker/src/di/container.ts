import "reflect-metadata";
import type { Redis } from "ioredis";
import { Container } from "inversify";
import { redisConnection } from "@cue-memory/db/redis";
import { FailItemUseCase } from "@/application/use-cases/items/FailItemUseCase";
import { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import { WORKER_TOKENS } from "@/di/tokens";
import type { IJsonFetcher } from "@/domain/providers/IJsonFetcher";
import type { IOEmbedProvider } from "@/domain/providers/IOEmbedProvider";
import type { IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import type { Database } from "@/infrastructure/database/Database";
import { db } from "@/infrastructure/database/db";
import { GuardedOEmbedProvider } from "@/infrastructure/http/GuardedOEmbedProvider";
import { SafeUrlFetcher } from "@/infrastructure/http/SafeUrlFetcher";
import { DrizzleItemRepository } from "@/infrastructure/repositories/DrizzleItemRepository";

/**
 * The worker's production container: the only place its concrete classes are
 * built and bound to their tokens. Infrastructure lives for the process's
 * life; use cases are built fresh for each job.
 */
export function createContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<Database>(WORKER_TOKENS.Database).toConstantValue(db);
  container.bind<Redis>(WORKER_TOKENS.RedisConnection).toConstantValue(redisConnection);
  container
    .bind<IItemRepository>(WORKER_TOKENS.ItemRepository)
    .to(DrizzleItemRepository)
    .inSingletonScope();
  // One SafeUrlFetcher serves both the page fetch and the oEmbed lookup's
  // JSON, so both go through the same guard.
  container.bind<IUrlFetcher>(WORKER_TOKENS.UrlFetcher).to(SafeUrlFetcher).inSingletonScope();
  container.bind<IJsonFetcher>(WORKER_TOKENS.JsonFetcher).toService(WORKER_TOKENS.UrlFetcher);
  container
    .bind<IOEmbedProvider>(WORKER_TOKENS.OEmbedProvider)
    .to(GuardedOEmbedProvider)
    .inSingletonScope();

  container
    .bind<ProcessItemUseCase>(WORKER_TOKENS.ProcessItemUseCase)
    .to(ProcessItemUseCase)
    .inTransientScope();
  container
    .bind<FailItemUseCase>(WORKER_TOKENS.FailItemUseCase)
    .to(FailItemUseCase)
    .inTransientScope();

  return container;
}
