import "reflect-metadata";
import { createClient } from "@supabase/supabase-js";
import type { Redis } from "ioredis";
import { Container } from "inversify";
import { redisConnection } from "@cue-memory/db/redis";
import { FailItemUseCase } from "@/application/use-cases/items/FailItemUseCase";
import { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import { WORKER_TOKENS } from "@/di/tokens";
import type { IImageFetcher } from "@/domain/providers/IImageFetcher";
import type { IJsonFetcher } from "@/domain/providers/IJsonFetcher";
import type { IOEmbedProvider } from "@/domain/providers/IOEmbedProvider";
import type { IThumbnailResizer } from "@/domain/providers/IThumbnailResizer";
import type { IThumbnailStore } from "@/domain/providers/IThumbnailStore";
import type { IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import type { Database } from "@/infrastructure/database/Database";
import { db } from "@/infrastructure/database/db";
import { GuardedOEmbedProvider } from "@/infrastructure/http/GuardedOEmbedProvider";
import { SafeUrlFetcher } from "@/infrastructure/http/SafeUrlFetcher";
import { SharpThumbnailResizer } from "@/infrastructure/images/SharpThumbnailResizer";
import { DrizzleItemRepository } from "@/infrastructure/repositories/DrizzleItemRepository";
import { NoThumbnailStore } from "@/infrastructure/storage/NoThumbnailStore";
import { supabaseStorageEnv } from "@/infrastructure/storage/supabaseEnv";
import { SupabaseThumbnailStore } from "@/infrastructure/storage/SupabaseThumbnailStore";

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
  // One SafeUrlFetcher serves the page fetch, the oEmbed lookup's JSON and
  // the Thumbnail image download, so all go through the same guard.
  container.bind<IUrlFetcher>(WORKER_TOKENS.UrlFetcher).to(SafeUrlFetcher).inSingletonScope();
  container.bind<IJsonFetcher>(WORKER_TOKENS.JsonFetcher).toService(WORKER_TOKENS.UrlFetcher);
  container
    .bind<IOEmbedProvider>(WORKER_TOKENS.OEmbedProvider)
    .to(GuardedOEmbedProvider)
    .inSingletonScope();
  container.bind<IImageFetcher>(WORKER_TOKENS.ImageFetcher).toService(WORKER_TOKENS.UrlFetcher);
  container
    .bind<IThumbnailResizer>(WORKER_TOKENS.ThumbnailResizer)
    .to(SharpThumbnailResizer)
    .inSingletonScope();
  container.bind<IThumbnailStore>(WORKER_TOKENS.ThumbnailStore).toConstantValue(thumbnailStore());

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

/**
 * Supabase Storage when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
 * set; otherwise the stand-in, so the worker still runs, without Thumbnails.
 * A server client: no session to keep or refresh.
 */
function thumbnailStore(): IThumbnailStore {
  const env = supabaseStorageEnv(process.env);
  if (!env) {
    console.warn("[worker] Supabase Storage isn't configured; Items get no Thumbnails");
    return new NoThumbnailStore();
  }
  const supabase = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return new SupabaseThumbnailStore(supabase);
}
