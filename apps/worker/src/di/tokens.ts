/**
 * The worker container's runtime names, separate from the API's `TOKENS`.
 * Interfaces don't exist at runtime, so each dependency is looked up by a
 * unique Symbol; `di/container.ts` binds them.
 */
export const WORKER_TOKENS = {
  /** The Drizzle database over the shared Postgres client. */
  Database: Symbol("Database"),
  /** The shared Redis connection (`maxRetriesPerRequest: null`, as BullMQ needs) jobs arrive on. */
  RedisConnection: Symbol("RedisConnection"),
  /** `IItemRepository`: the Items Processing reads and finishes. */
  ItemRepository: Symbol("IItemRepository"),
  /** `IUrlFetcher`: the guarded fetch of every Source URL. */
  UrlFetcher: Symbol("IUrlFetcher"),
  /** `IOEmbedProvider`: the guarded oEmbed lookup that types and titles a page. */
  OEmbedProvider: Symbol("IOEmbedProvider"),
  /** `ProcessItemUseCase`: what a Process Item job runs. */
  ProcessItemUseCase: Symbol("ProcessItemUseCase"),
  /** `FailItemUseCase`: what a Process Item job's last failed attempt runs. */
  FailItemUseCase: Symbol("FailItemUseCase"),
} as const;
