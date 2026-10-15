import "reflect-metadata";
import type { Redis } from "ioredis";
import { Container } from "inversify";
import { redisConnection } from "@cue-memory/db/redis";
import { WORKER_TOKENS } from "@/di/tokens";
import type { Database } from "@/infrastructure/database/Database";
import { db } from "@/infrastructure/database/db";

/**
 * The worker's production container: the only place its concrete classes are
 * built and bound to their tokens. Infrastructure lives for the process's
 * life; use cases, once there are any, are built fresh each time.
 */
export function createContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<Database>(WORKER_TOKENS.Database).toConstantValue(db);
  container.bind<Redis>(WORKER_TOKENS.RedisConnection).toConstantValue(redisConnection);

  return container;
}
