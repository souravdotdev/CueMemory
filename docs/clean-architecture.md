# Clean Architecture

This project follows Clean Architecture (ports-and-adapters / the dependency rule) **strictly, as a standing rule for every code change** — not a one-time refactor to admire. Read this before adding or modifying any backend code in `apps/api`, `apps/worker`, or `packages/*`.

## The dependency rule

Source code dependencies point **inward only**. Outer layers depend on inner layers; inner layers know nothing about outer layers.

```
presentation      (Fastify routes, BullMQ job processors, DTOs)
        ↓ depends on
infrastructure     (Drizzle repositories/schema, BullMQ adapters, connection wiring)
        ↓ depends on
application        (use cases)
        ↓ depends on
domain             (entities, port interfaces, pure business rules)
```

An inner layer never imports from an outer one. A feature's `domain`/`application` code never imports `drizzle-orm`, `bullmq`, or `fastify` — it only knows about the **port interfaces** it defines itself.

## Feature-first packages, not layer-first packages

Each **feature** is its own pnpm workspace package with all four layers nested inside it (`domain/`, `application/`, `infrastructure/`, `presentation/`), rather than one package per technical layer shared across every feature. A feature is a self-contained vertical slice — everything needed to build, persist, and expose it lives in one place, and the dependency rule is enforced _within_ that package by which subfolder imports which.

This repo currently has two feature packages:

- **`packages/items`** — the paste-a-link save/list/process flow. Has real code in all four layers.
- **`packages/auth`** — the `User` entity, the Better Auth-compatible DB schema, Google sign-in (the Better Auth instance and the Fastify plugin that mounts it), and knowing who's calling: the `SessionResolver` port, the `resolveSignedInUser` use case, the `requireUser` guard and `GET /me`. All four layers have real code.

`tags`, `collections`, and `reminders` do **not** have their own feature packages: they have no independent ports, use cases or routes. Their tables live inside `packages/items` as item-aggregate data (the `tags` and `item_tags` tables already do, from the tags design, #11). If one of them grows independent behavior (its own CRUD, its own route), it becomes its own feature package at that point, following the same pattern `items`/`auth` already establish.

## The `items` feature, layer by layer

- **`domain/`** — `ports/` (`ItemRepository`, `ItemQueue`, `MetadataFetcher` — interfaces infrastructure must implement), `detect-item-type.ts` (a pure business rule: inferring item type from a URL), `tag.ts` (the `Tag` and `TagLink` entities, `TAG_SOURCES`, and `AppliedTag`: a Tag with the source it was applied with), `tag-name.ts` (`slugifyTagName`, the pure rule that turns a Tag name into its canonical slug, plus `TAG_NAME_PATTERN`/`MAX_TAG_NAME_LENGTH`), `tokens.ts` (DI symbols for this package's ports).
- **`application/use-cases/`** — the actual interactors: `saveItem`, `listItems`, `processItem`. Each takes a `deps` object typed against the port interfaces, plus a plain input object, and returns a plain result. No HTTP, no SQL, no queue library — fully unit-testable by passing hand-written fake implementations of the ports.
- **`infrastructure/`**:
  - `persistence/` — `schema/` (the Drizzle `items` table, with its generated keyword-search `search_vector` column, and its `item_type`/`item_status` enums, built from the domain's `ITEM_TYPES`/`ITEM_STATUSES`; imports `users` from `@cue-memory/auth/schema` only for the FK column type; `tags.ts` holds the `tags` and `item_tags` tables and the `tag_source` enum, built from `TAG_SOURCES`, `TAG_NAME_PATTERN` and `MAX_TAG_NAME_LENGTH`), `drizzle-item-repository.ts` (`DrizzleItemRepository implements ItemRepository`), `item-mappers.ts` (`toItem` — translates Drizzle's raw `items` row, minus `search_vector`, into the domain `Item`, keeping dates as `Date`), `tag-mappers.ts` (`toTag` and `toTagLink` — the `tags` and `item_tags` rows into the domain `Tag` and `TagLink`, dropping the link's denormalized `user_id`).
  - `queue/` — `queues.ts` (the BullMQ `Queue` instance + queue name constants), `bullmq-item-queue.ts` (`BullMqItemQueue implements ItemQueue`).
  - `metadata/` — `stub-metadata-fetcher.ts` (`StubMetadataFetcher implements MetadataFetcher`, currently a placeholder — the seam where real extraction gets plugged in later).
- **`presentation/`**:
  - `http/` — `item-card-mapper.ts` (`toItemCardDto(item, tags, thumbnails)`: the explicit Item → `ItemCardDto` mapping against `@cue-memory/contracts/items`, taking the Item's Tags as the domain's `AppliedTag` `{ tag, source }` pairs (a `Tag` joined with its `TagLink`'s source) and a `ThumbnailUrlResolver` port from `domain/ports`; it also holds the compile-time check that the domain's `ITEM_TYPES`/`ITEM_STATUSES`/`TAG_SOURCES` match the contract's enums). No Items route exists yet; when one does, it lives here as a Fastify controller that declares its contracts, calls a use case and returns the mapper's output.
  - `queue/` — `process-item.processor.ts` (`createProcessItemHandler` — the BullMQ delivery-mechanism equivalent of a route controller: unwraps a `Job`, calls the `processItem` use case).

Package exports: `.` (the full barrel — domain + application + infrastructure + presentation) and `./schema` (schema-only, so `packages/db`'s migration runner can read table definitions without pulling in Fastify/BullMQ).

## The `auth` feature, layer by layer

Better Auth runs inside the API and owns the sign-in flow ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md)). Every Better Auth detail stays in this package's `infrastructure/`; the rest of the code only ever sees the domain `User`.

- **`domain/`** — `user.ts` (the `User` entity; `isDeleted`, the rule that a User with a deletion time is deleted; and `SignInProfile`, what the sign-in provider says about the User right now, with a null name when it sends none), `sign-in-decision.ts` (`decideSignIn(deletedAt, now)`, the pure rule that a sign-in is `allow`, `restore` or `refuse`; `GRACE_PERIOD_DAYS` = 30, with a User deleted exactly 30 days ago still restorable; and `UserPermanentlyDeletedError`), `ports/session-resolver.ts` (`SessionResolver`: takes a request's web `Headers` and returns the User of its valid Session, or null), `ports/user-repository.ts` (`UserRepository`: `findById` and `recordSignIn` with `UserSignInChanges` — Display name, avatar and deletion time only, so no code path can change the email).
- **`application/use-cases/`**:
  - `admitSignIn({ users }, { userId, profile, now })` — the sign-in rules (Auth ADR 0001, spec #12): loads the User, applies `decideSignIn`, throws `UserPermanentlyDeletedError` on refuse, clears the deletion time on restore, and refreshes the avatar and (when the provider sends one) the Display name on every allowed sign-in. The email is never touched.
  - `resolveSignedInUser({ sessions }, { headers })` — the User of the request's Session, or null when there's no valid Session or the User `isDeleted`, so a deleted User's old Sessions are refused everywhere (Auth ADR 0001).
- **`infrastructure/`**:
  - `better-auth/sign-in-hook.ts` — `createSignInHook(users)`, Better Auth's `databaseHooks.session.create.before`: just before a Session is created it reads the User's Google ID token from their Sign-in identity (Better Auth has just stored the fresh one), runs `admitSignIn`, and turns a refusal into a coded `APIError` (`USER_PERMANENTLY_DELETED`), which ends the OAuth flow at the error URL with that code and a readable `error_description`. A missing Google ID token ends it the same way, coded `GOOGLE_PROFILE_UNAVAILABLE`. `createAuth` pins `account.updateAccountOnSignIn: true` (Better Auth's default) because the hook relies on the ID token being fresh. Better Auth's `overrideUserInfoOnSignIn` is deliberately not used: it would also overwrite the email.
  - `better-auth/google-profile.ts` — `googleProfileFromIdToken`: the Display name and avatar from the ID token's `name`/`picture` claims, the same profile Better Auth's Google provider reads (no photo → null avatar, no name → null).
  - `better-auth/better-auth-session-resolver.ts` — `BetterAuthSessionResolver implements SessionResolver`: wraps Better Auth's server-side `getSession` (passed in as the one-method `SessionApi`, so its tests use a fake) and maps its User to the domain `User` through `toUser`.
  - `better-auth/create-auth.ts` — `createAuth(db, config, { users })`, the factory that builds the Better Auth instance from a database handle, an `AuthConfig` (secret, base URL, web origin, Google credentials, optional cookie domain) and the `UserRepository` its sign-in hook uses. It holds every Better Auth decision: the Drizzle adapter with Better Auth's model names mapped explicitly to the plural tables, the database generating uuid ids (`generateId: "uuid"`), Google as the only provider with identity scopes only (`openid email profile`, and a `before` hook that refuses any `scopes` a caller adds to the request), OAuth tokens encrypted at rest, the default 7-day Session with no cookie cache (every request checks the `sessions` table, so revocation is immediate), cross-subdomain cookies only when a cookie domain is configured, the web origin as the only trusted origin, the sign-in hook, and `deletedAt` declared as an additional User field (never settable through Better Auth's API) so every Session lookup returns it. Better Auth's `image` field needs no mapping: the `users` table's Drizzle key is `image`, stored in the `profile_img` column, and `toUser` renames it to `profileImg`.
  - `persistence/` — `schema/` (the Better Auth-compatible `users`/`sessions`/`accounts`/`verifications` tables; see [Database](./database.md#schema)), `user-mappers.ts` (`toUser`), `auth-database.ts` (the `AuthDatabase` handle type), `drizzle-user-repository.ts` (`DrizzleUserRepository implements UserRepository`), and `database.ts` (`db`: this package's own `drizzle(pgClient, { schema })`, the first runtime Drizzle instance; see [Shared infrastructure](#shared-infrastructure)).
- **`presentation/http/`**:
  - `require-user.ts` — `requireUser({ sessions })`, the guard every protected route runs as its `preHandler`: it calls `resolveSignedInUser` and throws a 401, which the shared error handler sends as the `unauthorized` envelope, or attaches the domain User to the request. Routes read it with `signedInUser(request)`; no route parses identity headers itself.
  - `me-routes.ts` + `me-mapper.ts` — `meRoutes`, the `GET /me` route behind the guard, and `toMeResponseDto`, the explicit User → `MeResponseDto` mapping against `@cue-memory/contracts/auth` (display name, email, avatar URL, ISO created time; never the deletion time).
  - `web-headers.ts` — `toWebHeaders`, Node's request headers as web `Headers`, shared by the guard and `authRoutes`.
  - `auth-routes.ts` — `authRoutes`, a Fastify plugin that mounts Better Auth's handler under `/api/auth/*` (GET and POST): it turns Fastify's request into a web `Request` (the body passed through as raw bytes, whatever its content type), and sends Better Auth's `Response` back unchanged, every `set-cookie` included. It takes the handler as a one-method `AuthRequestHandler`, so its tests use a fake, and a per-route rate limit that `apps/api` sets stricter than the global one (see [Security](./security.md#rate-limiting)).

Package exports: `.` (the barrel — domain, application, infrastructure, presentation, but not the runtime `db`), `./database` (`db`, kept off the barrel because importing it validates `DATABASE_URL`, which tests and the barrel's other consumers shouldn't need — the same reason `@cue-memory/db`'s `./client` and `./redis` are separate subpaths), and `./schema` (schema-only, for `packages/items`).

## Shared infrastructure

**`packages/db`** is not a feature package. It holds what is genuinely cross-feature:

- The raw connection primitives: `src/postgres/client.ts` (a raw `postgres()` client, **not** wrapped in `drizzle()` — no schema bound here) and `src/redis/connection.ts` (a raw `ioredis` instance). Exported as two independent subpaths, `./client` and `./redis`, specifically so importing one doesn't eagerly validate the other's env vars (e.g. the migration runner only needs `DATABASE_URL`, not `REDIS_URL`); `src/entry-points.test.ts` holds that line.
- The single centralized Drizzle-kit migration runner: `drizzle.config.ts` points at the feature packages' schema barrels by path (it can't import them, since they depend on this package for the Postgres client). One Postgres database has one migration history spanning every feature's tables, so this can't be split per feature the way application code can.

Each feature package wraps the shared raw `pgClient` in its **own** local `drizzle(pgClient, { schema })` call (e.g. `packages/items/src/infrastructure/persistence/drizzle-item-repository.ts`) — safe because the connection pool lives in the raw postgres client, not the Drizzle wrapper, so multiple independent `drizzle()` instances coexist over it without conflict.

Dependency graph is acyclic: `items → auth` (schema-only, for the `users` FK column type), `items → contracts`, `auth → db` (for the runtime `db`), `auth → contracts`, `api → auth`, `api → db` (the Redis connection), `api → contracts`, `web → contracts`, `contracts →` nothing (only zod), `db →` no `@cue-memory/*` runtime package. `auth` never depends on `items`.

## The composition roots

Concrete adapters get wired into use cases at the **composition root**, the one spot in each app allowed to know about every concrete implementation at once. Wiring uses an [InversifyJS](https://inversify.io) `Container`:

- `apps/api/src/composition.ts` — binds `ItemsTypes.ItemRepository → DrizzleItemRepository` and `ItemsTypes.ItemQueue → BullMqItemQueue` (both `inSingletonScope()`, both imported from `@cue-memory/items`), resolves both via `container.get(...)`, exports the result as a plain `dependencies` object.
- `apps/worker/src/composition.ts` — binds `ItemsTypes.ItemRepository → DrizzleItemRepository` and `ItemsTypes.MetadataFetcher → StubMetadataFetcher`, same pattern, same source package.

Neither composition root imports `@cue-memory/db` — that package has no runtime exports left to import. As more features gain ports (e.g. `auth` growing a real repository), their composition-root bindings get added the same way, each feature's `TYPES` imported under its own alias (`TYPES as ItemsTypes`, `TYPES as AuthTypes`, ...) so multiple registries coexist cleanly.

Both `apps/api/src/index.ts` and `apps/worker/src/index.ts` import the resolved `dependencies` object from their composition root and pass it into a controller/handler factory (`itemRoutes(dependencies)`, `createProcessItemHandler(dependencies)`), which closes over it and passes it through to use-case calls unchanged. The container is purely an implementation detail of `composition.ts` — nothing in a feature's use cases, routes, or job processor knows Inversify exists.

**Setup requirements** (both `apps/api` and `apps/worker`):

- `import "reflect-metadata";` as the literal first line of `src/index.ts`.
- `experimentalDecorators: true` and `emitDecoratorMetadata: true` in `tsconfig.json`, added only to the one package that actually declares `@injectable()` classes (`packages/items`) — not to the apps that merely reference them by identifier in `composition.ts`, and not to `packages/db` or `packages/auth`, neither of which has any decorated classes.

## DI tokens

Each feature package owns its own token registry, colocated with the ports it defines — `packages/items/src/domain/tokens.ts` exports `TYPES` (a plain `Symbol.for(...)` registry, deliberately not importing `inversify` itself, so the domain/application layers stay framework-free). `packages/auth` has ports (`SessionResolver`, `UserRepository`) but no tokens file: no DI container is in use today, so `apps/api/src/auth.ts` is the composition root for auth. It constructs `DrizzleUserRepository` and passes it to `createAuth`, and constructs `BetterAuthSessionResolver` and passes it to `meRoutes`. This keeps a feature's ports and their runtime identifiers as one unit that moves together, rather than a shared registry every feature reaches into.

## Where new code goes

Ask these questions in order:

1. **Is it a new business rule or workflow step for an existing feature?** → a new use case (or an addition to an existing one) in that feature's `application/use-cases`. Define whatever new port method it needs on the relevant interface in that feature's `domain/ports`.
2. **Does an existing port need a new capability to support that use case?** → add the method to the port interface in `domain/ports`, then implement it in the corresponding adapter under `infrastructure/`. The port interface changes first; the implementation follows.
3. **Is it a new external integration** (a new port entirely — e.g. an email sender, an LLM tagging client)? → define the port interface in that feature's `domain/ports`, write a concrete adapter for it under that feature's `infrastructure/`, and wire it into the relevant app's `composition.ts`.
4. **Is it purely a delivery-mechanism concern** (an HTTP route, request validation, response shaping, a new BullMQ queue registration)? → that feature's `presentation/`. It should still only ever call into that feature's `application/use-cases` for actual logic.
5. **Is it a genuinely new feature** with no existing package to live in? → a new `packages/<feature>` following the exact shape `items`/`auth` establish: start with whichever layers actually have content (often just `domain/` + `infrastructure/` for schema), and add `application/`/`presentation/` once real use cases/routes exist — never scaffold empty layer folders ahead of time.

**Hard rule**: if you find yourself importing `drizzle-orm`, `bullmq`, `postgres`, `ioredis`, or `fastify` types into a feature's `domain/` or `application/`, stop — that's the dependency rule being violated. Business logic must not know its infrastructure.

## Why this exists

Clean Architecture's indirection has a real cost — an extra port interface and adapter class for something that could be a single inline database call. It pays for itself here because:

- **Use cases are independently testable** — `saveItem`/`listItems`/`processItem` are tested (`packages/items/src/application/use-cases/*.test.ts`) with hand-written fake `ItemRepository`/`ItemQueue`/`MetadataFetcher` implementations, no database or Redis required. The same pattern extends to the controllers: `packages/items`' HTTP route tests and job-processor test both call the route/handler factory directly with fake dependencies, entirely bypassing the real `composition.ts` and its live infrastructure. See [Testing](./testing.md).
- **Swapping infrastructure is a one-file change** — replacing Drizzle, or adding a second delivery mechanism (a CLI, a second API framework) alongside Fastify, touches one feature's `infrastructure/`/`presentation/` folder, not the business logic itself.
- **A feature's full stack lives in one place** — reviewing or extending the paste-a-link flow means working inside `packages/items`, not jumping across three separately-versioned technical-layer packages to find the pieces that make up one concept.

## Why InversifyJS specifically

At the current scale — two dependencies per app, wired in a ~15-line composition root — manually calling `new DrizzleItemRepository()` would do the same job with less ceremony, and that's what this project did initially. Inversify was added ahead of that need, on the expectation that the dependency graph will grow (more use cases, more ports, deeper chains where one adapter depends on another). At that point, manually sequencing every `new X(y, z)` call by hand gets error-prone; a container resolves the whole graph from a binding registry instead, and gives lifecycle control (singleton/transient/request scope) as a declared setting rather than something to hand-build.

The design choice that matters most here: **only the composition roots and the concrete adapter classes know Inversify exists.** Each feature's `application/`/`domain` layers were deliberately kept plain-function-based rather than converted to injectable classes, specifically so they keep the property that made them valuable in the first place — trivial unit testing by passing hand-written fake objects, no container, no decorators, no metadata reflection required. Introducing a DI container didn't have to mean making everything in the codebase container-aware, and it doesn't here.
