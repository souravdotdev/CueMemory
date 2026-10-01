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
- **`packages/auth`** — currently just a `User` entity and the better-auth-compatible DB schema. No port, use case, or route exists for auth yet (the API fakes it with an `x-user-id` dev header — see [API](./api.md#auth-placeholder)), so `application/`/`presentation/` folders don't exist in this package. **They appear only once real auth behavior is built, not before** — this is a deliberate application of the project's "no scaffolding for hypothetical requirements" rule, not an oversight.

`tags`, `collections`, and `reminders` do **not** have their own feature packages: they have no independent ports, use cases or routes. Their tables live inside `packages/items` as item-aggregate data (the `tags` and `item_tags` tables already do, from the tags design, #11). If one of them grows independent behavior (its own CRUD, its own route), it becomes its own feature package at that point, following the same pattern `items`/`auth` already establish.

## The `items` feature, layer by layer

- **`domain/`** — `ports/` (`ItemRepository`, `ItemQueue`, `MetadataFetcher` — interfaces infrastructure must implement), `detect-item-type.ts` (a pure business rule: inferring item type from a URL), `tag.ts` (the `Tag` and `TagLink` entities, `TAG_SOURCES`, and `AppliedTag`: a Tag with the source it was applied with), `tag-name.ts` (`slugifyTagName`, the pure rule that turns a Tag name into its canonical slug, plus `TAG_NAME_PATTERN`/`MAX_TAG_NAME_LENGTH`), `tokens.ts` (DI symbols for this package's ports).
- **`application/use-cases/`** — the actual interactors: `saveItem`, `listItems`, `processItem`. Each takes a `deps` object typed against the port interfaces, plus a plain input object, and returns a plain result. No HTTP, no SQL, no queue library — fully unit-testable by passing hand-written fake implementations of the ports.
- **`infrastructure/`**:
  - `persistence/` — `schema/` (the Drizzle `items` table and its `item_type`/`item_status` enums, built from the domain's `ITEM_TYPES`/`ITEM_STATUSES`; imports `users` from `@cue-memory/auth/schema` only for the FK column type; `tags.ts` holds the `tags` and `item_tags` tables and the `tag_source` enum, built from `TAG_SOURCES`, `TAG_NAME_PATTERN` and `MAX_TAG_NAME_LENGTH`), `drizzle-item-repository.ts` (`DrizzleItemRepository implements ItemRepository`), `item-mappers.ts` (`toItem` — translates Drizzle's raw `items` row into the domain `Item`, keeping dates as `Date`), `tag-mappers.ts` (`toTag` and `toTagLink` — the `tags` and `item_tags` rows into the domain `Tag` and `TagLink`, dropping the link's denormalized `user_id`).
  - `queue/` — `queues.ts` (the BullMQ `Queue` instance + queue name constants), `bullmq-item-queue.ts` (`BullMqItemQueue implements ItemQueue`).
  - `metadata/` — `stub-metadata-fetcher.ts` (`StubMetadataFetcher implements MetadataFetcher`, currently a placeholder — the seam where real extraction gets plugged in later).
- **`presentation/`**:
  - `http/` — `item-card-mapper.ts` (`toItemCardDto(item, tags, thumbnails)`: the explicit Item → `ItemCardDto` mapping against `@cue-memory/contracts/items`, taking the Item's Tags as the domain's `AppliedTag` `{ tag, source }` pairs (a `Tag` joined with its `TagLink`'s source) and a `ThumbnailUrlResolver` port from `domain/ports`; it also holds the compile-time check that the domain's `ITEM_TYPES`/`ITEM_STATUSES`/`TAG_SOURCES` match the contract's enums). No Items route exists yet; when one does, it lives here as a Fastify controller that declares its contracts, calls a use case and returns the mapper's output.
  - `queue/` — `process-item.processor.ts` (`createProcessItemHandler` — the BullMQ delivery-mechanism equivalent of a route controller: unwraps a `Job`, calls the `processItem` use case).

Package exports: `.` (the full barrel — domain + application + infrastructure + presentation) and `./schema` (schema-only, so `packages/db`'s migration runner can read table definitions without pulling in Fastify/BullMQ).

## The `auth` feature — deliberately partial

- **`domain/user.ts`** — the `User` entity.
- **`infrastructure/persistence/`** — `schema/` (the better-auth-compatible `users`/`sessions`/`verifications` tables; see [Database](./database.md#schema)), `user-mappers.ts` (`toUser`).

No `application/` or `presentation/` folder exists in this package. Don't create them speculatively — add them when a real auth port, use case, or route is actually being built, following the exact shape `items` already demonstrates.

## Shared infrastructure

Two things are genuinely cross-feature and don't belong inside any one feature package:

- **`packages/shared-kernel`** — raw connection primitives only: `db/client.ts` (a raw `postgres()` client, **not** wrapped in `drizzle()` — no schema bound here) and `redis/connection.ts` (a raw `ioredis` instance). Exported as two independent subpaths, `./db` and `./redis`, specifically so importing one doesn't eagerly validate the other's env vars (e.g. `packages/db`'s migration runner only needs `DATABASE_URL`, not `REDIS_URL`). No `@cue-memory/*` dependencies — a true leaf package.
- **`packages/db`** — not a feature package. It's the single centralized Drizzle-kit migration runner: `schema.ts` re-exports `@cue-memory/items/schema` + `@cue-memory/auth/schema`, and `drizzle.config.ts` points at that shim. One Postgres database has one migration history spanning every feature's tables, so this can't be split per feature the way application code can.

Each feature package wraps the shared raw `pgClient` in its **own** local `drizzle(pgClient, { schema })` call (e.g. `packages/items/src/infrastructure/persistence/drizzle-item-repository.ts`) — safe because the connection pool lives in the raw postgres client, not the Drizzle wrapper, so multiple independent `drizzle()` instances coexist over it without conflict.

Dependency graph is acyclic: `db → items`, `db → auth`, `items → auth` (schema-only, for the `users` FK column type), `items → shared-kernel`, `items → contracts`, `api → contracts`, `web → contracts`, `contracts →` nothing (only zod), `auth →` nothing. `auth` never depends on `items`, and neither depends back on `db`.

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

Each feature package owns its own token registry, colocated with the ports it defines — `packages/items/src/domain/tokens.ts` exports `TYPES` (a plain `Symbol.for(...)` registry, deliberately not importing `inversify` itself, so the domain/application layers stay framework-free). `packages/auth` has no ports yet, so it has no tokens file at all. This keeps a feature's ports and their runtime identifiers as one unit that moves together, rather than a shared registry every feature reaches into.

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
