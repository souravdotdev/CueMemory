# Clean Architecture

The backend follows Clean Architecture as a standing rule for every code change. Read this before you add or change code in `apps/api` or `apps/worker`. Why the shape is layer-first, with use-case classes and a container, is in [ADR 0004](./adr/0004-layer-first-apps-with-use-case-classes-and-a-di-container.md). Why wire shapes are shared zod schemas, separate from the entities, is in [ADR 0001](./adr/0001-shared-zod-contracts-package.md). This doc describes the code as it is.

## The four layers

Each app is organised by layer, not by feature. The API's `src/` folder:

```
apps/api/src/
  index.ts              reflect-metadata first; createContainer(), buildApp(), listen
  app.ts                buildApp(container): plugins, error middleware, routes
  env.ts                the validated environment (Env)
  rate-limit-redis.ts   the fail-fast Redis for the rate-limit store
  rate-limit-store.ts   RateLimitRedis type and IN_MEMORY_RATE_LIMITS (side-effect free)
  di/
    tokens.ts           TOKENS: one Symbol per bound dependency
    container.ts        createContainer(): the only place concrete classes are bound
  domain/
    entities/           User.ts (User, SignInProfile), Item.ts, Tag.ts
    repositories/       IUserRepository.ts, IItemRepository.ts
    providers/          ISessionProvider.ts, IThumbnailUrlProvider.ts, IQueueProvider.ts
    errors/             AppError and its subclasses (barrel: @/domain/errors)
    rules/              signInDecision.ts, tagName.ts (pure functions)
  application/
    use-cases/auth/     AdmitSignInUseCase, ResolveSignedInUserUseCase, GetMeUseCase
    use-cases/items/    SaveItemUseCase
    dto/auth/           MeOutput.ts
    dto/items/          ItemCardOutput.ts (toItemCardOutput)
  infrastructure/
    auth/               createAuth.ts, signInHook.ts, googleProfile.ts, BetterAuthSessionProvider.ts
    database/           Database.ts (the handle type), db.ts (the runtime Drizzle instance)
    queue/              BullMqQueueProvider.ts, itemsQueue.ts (the BullMQ Items queue)
    repositories/       DrizzleUserRepository.ts, DrizzleItemRepository.ts
    storage/            SupabaseThumbnailUrlProvider.ts (signs Thumbnail links)
    mappers/            userMapper.ts, itemMapper.ts, tagMapper.ts (row -> entity)
  interface/
    routes/             auth.routes.ts, me.routes.ts, items.routes.ts (Fastify plugins)
    controllers/        MeController.ts, ItemsController.ts
    middleware/         auth.middleware.ts, error.middleware.ts
    http/               toWebHeaders.ts
```

What each layer holds:

- **`domain/`** holds the business vocabulary and nothing else. It has entities (plain interfaces, dates as `Date`), ports (`I`-prefixed interfaces: repositories for storage, providers for every other outside service), errors and pure rules. Examples of rules: `decideSignIn(deletedAt, now)` returns `allow`, `restore` or `refuse`, with `GRACE_PERIOD_DAYS = 30`. `isDeleted(user)` says whether a User is deleted. `slugifyTagName` and `TAG_NAME_PATTERN` define Tag names. The domain imports nothing outside itself.
- **`domain/errors/`** has `AppError(message, code)` with `NotFoundError`, `RepositoryError`, `UnauthorizedError` and `UserPermanentlyDeletedError`. A domain error carries a code (`AppErrorCode`), never an HTTP status.
- **`application/`** holds the use cases and their DTOs. A use case is an `@injectable()` class named `XUseCase` with one `execute(input)` method. It gets its ports through `@inject(TOKENS.X)` constructor parameters. It returns an output DTO shaped for its view (for example `MeOutput`, `ItemCardOutput`), not an entity. Input types sit beside the use case (`AdmitSignInInput`). Output DTOs sit in `dto/<feature>/`. One exception, by design: `ResolveSignedInUserUseCase` returns the domain `User` entity, because the auth middleware attaches that User to the request for the use cases behind protected routes. Those use cases take the User as input (`GetMeUseCase.execute(user)`). The entity never reaches the wire: each route's use case still returns an output DTO.
- **`infrastructure/`** holds the adapters: classes and functions that implement a domain port with a real tool. Examples: `DrizzleUserRepository implements IUserRepository`, `BetterAuthSessionProvider implements ISessionProvider`, and `createAuth`, which builds the Better Auth instance with every auth option ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md)). The row mappers (`toUser`, `toItem`, `toTag`, `toTagLink`) turn `@resonory/db` rows into entities. Tables, the Postgres client and the Redis connection come from `packages/db` (see [Database](./database.md)).
- **`interface/`** holds the delivery mechanism (Fastify). Route plugins declare the shared request and response schemas, controllers do the HTTP work and call one use case, and middleware handles who is calling and how errors become responses. `error.middleware.ts` is the one place that maps an `AppError` code to an HTTP status and the shared error envelope. Zod validation failures become 400, and any other error becomes a generic 500 with the details only in the logs.

`di/` sits outside the four layers. It is the composition root: the only code that knows every concrete class.

Items has a domain (`Item`, `Tag`, the Tag name rule), the `IItemRepository` and `IQueueProvider` ports with their adapters, the Item card output DTO, row mappers, and one use case and route: `SaveItemUseCase` behind `POST /items`. `IThumbnailUrlProvider`'s adapter, `SupabaseThumbnailUrlProvider`, signs 1-hour links into the private `thumbnails` bucket. It's bound only when Supabase Storage is configured; with no provider, `toItemCardOutput` gives every card a null Thumbnail URL. A just-saved Item has no Thumbnail key, so `SaveItemUseCase` passes no provider.

## The dependency rule

Source code dependencies point inward only:

```
interface        (routes, controllers, middleware)        ┐
infrastructure   (Better Auth, Drizzle repositories, ...)  ┘ outer: may import application and domain
        ↓
application      (use cases, DTOs)                         may import domain
        ↓
domain           (entities, ports, errors, rules)          imports nothing outside itself
```

An inner layer never imports an outer one. Domain and application code knows only the ports the domain defines, never the tool behind them. `ResolveSignedInUserUseCase` depends on `ISessionProvider`, not on Better Auth. `AdmitSignInUseCase` depends on `IUserRepository`, not on Drizzle. Use cases may import `inversify` (for `@injectable`/`@inject`), `zod` and `@resonory/shared`. `@/di/tokens` is allowed too, because it holds only Symbols.

### Lint guard

In the API, lint enforces this rule. `apps/api/eslint.config.js` sets `no-restricted-imports` on `src/domain/**` and `src/application/**`. It blocks these imports: `drizzle-orm`, `fastify` (and `@fastify/*`, `fastify-*`), `better-auth`, `postgres`, `ioredis`, `bullmq`, `@supabase/*` and `@resonory/db`. Subpaths and `import type` are blocked too. If a domain or application file imports one of them, `pnpm lint` fails:

```
src/domain/zz-demo/bad.ts
  1:1  error  'drizzle-orm' import is restricted from being used by a pattern. Domain and application never import tools. Drizzle belongs in infrastructure. Depend on a port instead  no-restricted-imports
src/application/zz-demo/bad.ts
  1:1  error  'ioredis' import is restricted from being used by a pattern. Domain and application never import tools. Redis belongs in infrastructure. Depend on a port instead  no-restricted-imports
```

To fix it, define a port in the domain and put the tool code in an infrastructure adapter. If you add a new tool library to the API, add it to the list. The guard runs in `pnpm lint` and in the pre-commit hook.

## Tokens, the container and scopes

Interfaces don't exist at runtime, so the container looks each dependency up by a token. `di/tokens.ts` exports `TOKENS`, one `Symbol` per bound dependency. A port's symbol is named after its interface (`TOKENS.UserRepository = Symbol("IUserRepository")`). Today the tokens are `Env`, `Database`, `UserRepository`, `Auth`, `SessionProvider`, `AdmitSignInUseCase`, `ResolveSignedInUserUseCase`, `GetMeUseCase`, `MeController`, `ItemRepository`, `ItemsQueue`, `QueueProvider`, `ThumbnailStorage`, `ThumbnailUrlProvider`, `SaveItemUseCase`, `ItemsController` and `RateLimitRedis`.

`di/container.ts` exports `createContainer()`, an InversifyJS `Container`. It is the only place in application code that creates an application class. It binds:

- **Constants** (`toConstantValue`): the validated `Env`, the `Database` (`db` from `infrastructure/database/db.ts`), the rate-limit Redis and the BullMQ Items queue (`itemsQueue`).
- **The Better Auth instance** (`toDynamicValue(...).inSingletonScope()`): built once, by `createAuth(database, config, { admitSignIn })` from the bound `Env` and `Database`. Its session-create hook gets `admitSignIn` as `{ execute }`, which asks the container for a fresh `AdmitSignInUseCase` on every sign-in. The binding ends `satisfies { api: SessionApi }`, so tsc checks that the instance still fits what `BetterAuthSessionProvider` needs.
- **Adapters and controllers as singletons** (`.to(Class).inSingletonScope()`): `DrizzleUserRepository`, `DrizzleItemRepository`, `BetterAuthSessionProvider`, `BullMqQueueProvider`, `MeController`, `ItemsController`. One instance lives for the life of the process.
- **Thumbnail signing, only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set**: `ThumbnailStorage` (a Supabase `StorageClient`, `toDynamicValue(...).inSingletonScope()`, ending `satisfies ThumbnailStorage`) and `SupabaseThumbnailUrlProvider` as a singleton. Unset, neither token is bound.
- **Use cases as transient** (`.to(Class).inTransientScope()`): each `container.get` builds a new one, so a use case never carries state from one request to the next.

Setup rules that keep this working:

- `import "reflect-metadata"` comes first in `src/index.ts` and `di/container.ts`, and a test that imports a decorated class imports `reflect-metadata` first.
- `tsconfig.json` sets `experimentalDecorators` but deliberately not `emitDecoratorMetadata`: esbuild (tsup, tsx) can't emit it. So every constructor parameter must name its token with `@inject(TOKENS.X)`. A parameter without one won't resolve.
- Adding a use case takes three edits: the class, its token, and its binding. A missing binding fails when something resolves it, not at compile time. `tests/unit/di/container.test.ts` resolves every `TOKENS` entry through the real `createContainer()`, which catches it.

`buildApp(container, fastifyOptions)` in `app.ts` takes the container rather than building one. Production passes `createContainer()`. Tests pass their own container with fakes (see [Testing](#testing-at-two-seams)). `buildApp` reads `Env` and `RateLimitRedis` from the container. Both are required, so a container can't quietly fall back to in-memory rate limits by leaving the Redis out: production binds the Redis, and a test container binds `IN_MEMORY_RATE_LIMITS` (`src/rate-limit-store.ts`) on purpose.

## One request through every layer: `GET /me`

A signed-in browser calls `GET /me` with its Session cookie.

1. **Interface: the route.** `interface/routes/me.routes.ts` is a Fastify plugin registered by `buildApp` with `{ container }`. It declares `GET /me` with `preHandler: authMiddleware(container)` and the response schema `MeResponseSchema` from `@resonory/shared/schemas/auth`. The handler resolves `MeController` from the container. The route file never constructs it.
2. **Interface: the middleware.** `authMiddleware` resolves a fresh `ResolveSignedInUserUseCase` from the container. It turns Node's request headers into web `Headers` (`interface/http/toWebHeaders.ts`), calls `execute({ headers })` and attaches the returned domain `User` as `request.user`.
3. **Application: the use case.** `ResolveSignedInUserUseCase.execute` asks its `ISessionProvider` port for the Session's User. If there is none, or `isDeleted(user)` (a domain rule) says the User is deleted, it throws `UnauthorizedError` (a domain error). Otherwise it returns the User.
4. **Infrastructure: the adapter.** The container bound `ISessionProvider` to `BetterAuthSessionProvider`. It calls Better Auth's `api.getSession({ headers })`, which checks the `sessions` table on every request. It maps Better Auth's user to the domain `User` with the same `toUser` row mapper the repository uses: a missing `image` or `deletedAt` becomes null, and `image` becomes `profileImg`. Better Auth's internals stop here.
5. **Interface: the controller.** `MeController.getMe(request)` reads the User with `signedInUser(request)` and calls `GetMeUseCase.execute(user)`.
6. **Application: the output DTO.** `GetMeUseCase` is pure (it has no ports). It returns `MeOutput`: id, Display name, email, avatar URL and an ISO created time, never the deletion time.
7. **Interface: the response.** Fastify serializes `MeOutput` through `MeResponseSchema` (undeclared fields are stripped) and sends 200.

When step 3 throws `UnauthorizedError`, the error travels up to `error.middleware.ts`. It maps the code `UNAUTHORIZED` to 401 and sends the shared envelope `{ error: { code: "unauthorized", message: "You need to sign in to do that" } }`. The domain's own message never reaches the client.

Sign-in itself runs the same layers from a different front door. Better Auth's handler is mounted by `interface/routes/auth.routes.ts` under `/api/auth/*`. Just before a Session is created, its hook (`infrastructure/auth/signInHook.ts`) runs `AdmitSignInUseCase`. That use case applies `decideSignIn` through `IUserRepository` and throws `UserPermanentlyDeletedError` on refuse. The hook catches that error and turns it into Better Auth's coded `APIError` (see [Auth ADR 0001](./contexts/auth/adr/0001-soft-delete-users-with-30-day-restore.md)).

## Testing at two seams

Tests live in `apps/api/tests/unit/`, mirroring `src/`, and import through the `@/` alias. Fakes are small hand-written objects or `vi.fn()`, written inline in each test file. More detail is in [Testing](./testing.md).

- **The HTTP seam** covers everything a client can observe. `tests/unit/app.test.ts` builds the real app with `buildApp(testContainer())` and drives it with Fastify `inject`. `testContainer()` binds the real use cases and controller, a fake `ISessionProvider`, a fake `Auth` handler and a literal `Env`. It binds `RateLimitRedis` to `IN_MEMORY_RATE_LIMITS`. Tests check statuses, bodies and headers: 401 envelopes, `GET /me` output, CORS, security headers, 404 and generic 500 envelopes. A test that needs an extra route (for example one that throws a domain error) adds it to the built app before calling `inject`. `tests/unit/interface/routes/auth.routes.test.ts` uses the same seam for the `/api/auth/*` mount.
- **The use-case seam** covers business behaviour without the container: `new XUseCase(fake).execute(input)`. For example, `new ResolveSignedInUserUseCase(sessionsReturning(null))` rejects with `UnauthorizedError`. `AdmitSignInUseCase` is tested against a fake `IUserRepository`, checking the changes it records and the error it throws.

Pure domain rules (`signInDecision`, `tagName`), mappers, output DTOs, infrastructure adapters (`createAuth` over a mocked database, `BetterAuthSessionProvider`, `googleProfile`, `signInHook`) and env validation are tested directly against their own inputs and outputs. `tests/unit/di/container.test.ts` resolves every token through the real `createContainer()`, with a stubbed environment, a stand-in rate-limit Redis and a stand-in BullMQ Items queue (ioredis connects on construction; the Postgres client only on its first query, which the test never makes). No test needs a database or Redis.

## Where new code goes

1. **A new business rule** is a pure function in `domain/rules/`, tested on its own.
2. **A new workflow** is a use case in `application/use-cases/<feature>/XUseCase.ts`, with an output DTO in `application/dto/<feature>/` if it returns something. Add its token and a transient binding.
3. **A new need from the outside world** (storage, email, a queue, a model API) is a port in `domain/repositories/` or `domain/providers/`, an adapter in `infrastructure/`, a token, and a singleton binding. The port changes first, then the adapter.
4. **A new endpoint** is a route plugin in `interface/routes/` that declares shared schemas from `@resonory/shared`. Add a controller class in `interface/controllers/` that calls one use case, bind it as a singleton, and register the plugin in `buildApp`. Protected routes use `authMiddleware(container)` and read the User with `signedInUser(request)`. They never read identity from the body.
5. **A new error case** is an `AppError` subclass with a new `AppErrorCode`. Add the code to `statusOfCode` in `error.middleware.ts` (it is a `Record`, so tsc forces this).

Don't create empty layer folders ahead of time. A folder appears with its first file.

## The worker

`apps/worker` has the API's tooling: its own `WORKER_TOKENS` (`src/di/tokens.ts`) and `createContainer()` (`src/di/container.ts`), `reflect-metadata` loaded first in `index.ts`, `experimentalDecorators` and the `@/` alias in its `tsconfig.json` (mirrored in `vitest.config.ts`), tests in `tests/unit/`, and the same lint guard in its `eslint.config.js` (Drizzle, BullMQ, Postgres, Redis and `@resonory/db` are refused in `src/domain/` and `src/application/`). It fills in the same four layers; only the front door differs: a job arrives instead of an HTTP request, and a processor replaces the controller.

```
apps/worker/src/
  index.ts              reflect-metadata first; createContainer(), ping Redis, createItemsWorker
  di/                   tokens.ts (WORKER_TOKENS), container.ts
  domain/
    entities/           Item.ts (the fields Processing needs; ItemRef; ItemMetadata; ReadyItem, what Processing
                        learned; Item types and statuses),
                        PageHead.ts (a page head's extracted tags)
    repositories/       IItemRepository.ts (findById, markReady, markFailed)
    providers/          IUrlFetcher.ts (fetchPage → FetchedPage: html | file | unsuccessful),
                        IJsonFetcher.ts (fetchJson), IOEmbedProvider.ts (fetchOEmbed),
                        IImageFetcher.ts (fetchImage), IThumbnailResizer.ts (toCardThumbnail),
                        IThumbnailStore.ts (put)
    rules/              thumbnailCandidates.ts (which images, in which order), thumbnailImage.ts
                        (the one list of accepted image formats), magicBytes.ts (file signatures, shared
                        with itemTypeFromMagicBytes.ts), thumbnailKey.ts,
                        itemTypeFromUrl.ts, knownSites.ts (the known-site table, with each site's oEmbed
                        endpoint), itemTypeFromExtension.ts, itemTypeFromResponse.ts,
                        itemTypeFromContentType.ts, itemTypeFromMagicBytes.ts, mediaType.ts,
                        itemTypeFromJsonLd.ts, itemTypeFromOpenGraph.ts, itemTypeFromTwitterCard.ts,
                        oEmbed.ts (which endpoint to ask, oEmbed types), pageMetadata.ts,
                        parsedUrl.ts, collapseWhitespace.ts (pure functions)
  application/
    use-cases/items/    ProcessItemUseCase, FailItemUseCase
    dto/items/          ProcessItemResult.ts, FailItemResult.ts
  infrastructure/
    database/           Database.ts, db.ts
    http/               SafeUrlFetcher.ts, publicAddress.ts (the guarded fetch), readBody.ts (bounded body
                        reads), looksLikeHtml.ts (sniffs a body without a Content-Type),
                        parsePageHead.ts (htmlparser2), GuardedOEmbedProvider.ts (oEmbed over IJsonFetcher)
    images/             SharpThumbnailResizer.ts (the card Thumbnail, with sharp)
    storage/            SupabaseThumbnailStore.ts, supabaseEnv.ts (the optional SUPABASE_URL /
                        SUPABASE_SERVICE_ROLE_KEY; unset, no store is bound)
    repositories/       DrizzleItemRepository.ts
  interface/
    itemsJobs.ts        the job-name map: each name's processor and final-failure step
    itemsWorker.ts      createItemsWorker (the BullMQ Worker) and runItemsJob (the job switch)
    itemsJobFailed.ts   onItemsJobFailed (the Worker's `failed` handler)
    processors/         processItem.processor.ts, processItemFailed.processor.ts
```

| Part           | In the API                    | In the worker                                                   |
| -------------- | ----------------------------- | --------------------------------------------------------------- |
| Front door     | route + controller            | a job switch on `job.name` (`runItemsJob`) + a processor        |
| Input check    | the route's zod schema        | `XPayloadSchema.safeParse(job.data)` in the processor           |
| Business logic | use case                      | use case                                                        |
| Tokens         | `TOKENS` in `apps/api/src/di` | the worker's own `WORKER_TOKENS` and container                  |
| Queue names    | n/a                           | constants from a shared queue entry point, no typed-out strings |

- **The API enqueues through a port.** `SaveItemUseCase` depends on `IQueueProvider` in the domain, and `BullMqQueueProvider` in infrastructure implements it. The port takes its own `ProcessItemRequest`; the adapter maps it to the shared job payload. The use case never imports `bullmq`; the lint guard blocks it.
- **One worker per queue, routing by job name.** `interface/itemsWorker.ts` creates the BullMQ `Worker` for the Items queue. `interface/itemsJobs.ts` maps each job name to `{ process, onFinalFailure }`. The job switch `runItemsJob(container, job)` runs the name's `process`; an unknown name throws `UnrecoverableError`, so it is not retried. The `failed` handler, `onItemsJobFailed`, logs each failed attempt and, once BullMQ has no attempt left (`job.finishedOn` is set: the last retry, or a stall), runs the name's `onFinalFailure` (`processItemFailed`), which runs a use case like any processor.
- **A processor is a thin controller.** It lives in `interface/processors/`. It parses `job.data` with the payload's zod schema (an invalid payload throws `UnrecoverableError`), maps it to the use case's input, and calls `container.get<XUseCase>(WORKER_TOKENS.XUseCase).execute(input)`. Errors from the use case pass through, so BullMQ retries.
- **The worker has its own `di/tokens.ts` and `di/container.ts`.** It never shares or mixes the API's `TOKENS`. Its port symbols are named after their interfaces too (`WORKER_TOKENS.ItemRepository = Symbol("IItemRepository")`). Adapters (`DrizzleItemRepository`, `SafeUrlFetcher`, `GuardedOEmbedProvider`) are `@injectable()` singletons bound to their port's token with `.to(...).inSingletonScope()`, and depend on other ports by token only, never on a concrete class; use cases are transient. One `SafeUrlFetcher` implements two ports: it is bound to `WORKER_TOKENS.UrlFetcher` (`IUrlFetcher`), and `WORKER_TOKENS.JsonFetcher` (`IJsonFetcher`, which `GuardedOEmbedProvider` injects) is `.toService(WORKER_TOKENS.UrlFetcher)`, the same instance, so the page fetch and the oEmbed call share one guard; `WORKER_TOKENS.ImageFetcher` (`IImageFetcher`) is bound the same way, so the Thumbnail download shares it too. `WORKER_TOKENS.ThumbnailStore` is bound to a constant `SupabaseThumbnailStore` over `@supabase/storage-js`'s `StorageClient` (as in the API), and left unbound when Supabase Storage isn't configured, so `ProcessItemUseCase` (whose store is `@optional()`) gets none and downloads no image. `SafeUrlFetcher`'s options parameter is `@unmanaged()`, so the container builds it with the defaults and tests construct it directly with their own. Use-case results sit in `application/dto/items/`, as in the API. The worker's `Item` entity is its own (the domain can't import the API's); `tests/unit/domain/schema-agreement.test.ts` keeps its Item types and statuses equal to the database enums.
- **Two test seams, as in the API.** The processor seam drives `runItemsJob` with a fake job and a test container whose use case is a stand-in; use cases are tested with `new XUseCase(fake)`.

Payload schemas and queue names go in `@resonory/shared/schemas/queue` (today `ITEMS_QUEUE`, `PROCESS_ITEM_JOB`, `ProcessItemJobSchema`). See [Queue](./queue.md).
