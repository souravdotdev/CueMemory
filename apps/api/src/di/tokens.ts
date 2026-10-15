/**
 * The container's runtime names. Interfaces don't exist at runtime, so each
 * dependency is looked up by a unique Symbol; `di/container.ts` binds them.
 */
export const TOKENS = {
  /** The validated environment (`Env`). */
  Env: Symbol("Env"),
  /** The Drizzle database over the shared Postgres client. */
  Database: Symbol("Database"),
  /** Where Users are stored (`IUserRepository`). */
  UserRepository: Symbol("IUserRepository"),
  /** The Better Auth instance; routes use its web-standard request handler. */
  Auth: Symbol("Auth"),
  /** Finds the User behind a request's Session (`ISessionProvider`). */
  SessionProvider: Symbol("ISessionProvider"),
  /** The sign-in rules run before a Session is created (`AdmitSignInUseCase`). */
  AdmitSignInUseCase: Symbol("AdmitSignInUseCase"),
  /** Who is calling; refuses no Session or a deleted User (`ResolveSignedInUserUseCase`). */
  ResolveSignedInUserUseCase: Symbol("ResolveSignedInUserUseCase"),
  /** The signed-in User as the `GET /me` output (`GetMeUseCase`). */
  GetMeUseCase: Symbol("GetMeUseCase"),
  /** Serves `GET /me` (`MeController`). */
  MeController: Symbol("MeController"),
  /** Where Items are stored (`IItemRepository`). */
  ItemRepository: Symbol("IItemRepository"),
  /** The BullMQ Items queue the queue provider adds jobs to (`ItemsQueue`). */
  ItemsQueue: Symbol("ItemsQueue"),
  /** Hands background work to the worker (`IQueueProvider`). */
  QueueProvider: Symbol("IQueueProvider"),
  /** Saves a pasted URL as a Processing Item and enqueues its Processing (`SaveItemUseCase`). */
  SaveItemUseCase: Symbol("SaveItemUseCase"),
  /** Serves `POST /items` (`ItemsController`). */
  ItemsController: Symbol("ItemsController"),
  /** Where @fastify/rate-limit counts (`RateLimitRedis`): the fail-fast Redis, or explicitly in memory in tests. */
  RateLimitRedis: Symbol("RateLimitRedis"),
} as const;
