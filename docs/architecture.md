# Architecture

## Monorepo layout

Managed with [pnpm workspaces](https://pnpm.io/workspaces) + [Turborepo](https://turborepo.com). Two top-level groups:

```
apps/
  web/      Next.js frontend (feed + save-a-link pages)
  api/      Fastify API, organised by layer (ADR 0004):
              src/domain/          entities, ports (repositories/, providers/), errors, pure rules
              src/application/     use-case classes (XUseCase) and their output DTOs
              src/interface/       Fastify routes, controllers and middleware
              src/infrastructure/  adapters: Better Auth, Drizzle repositories, row mappers
              src/di/              tokens.ts and container.ts (the InversifyJS container)
  worker/   Background-job process consuming the Items queue, the same layers as the API
              src/domain/          the Item entity, the Item repository port, the URL rules
              src/application/     ProcessItemUseCase, FailItemUseCase
              src/interface/       itemsWorker.ts (BullMQ Worker + job switch), itemsJobFailed.ts (failed handler), processors/
              src/infrastructure/  adapters: the Drizzle database and Item repository
              src/di/              tokens.ts (WORKER_TOKENS) and container.ts

packages/
  shared/             zod request/response schemas for web <-> api; depends only on zod
                      (subpaths ./schemas/common, ./schemas/auth, ./schemas/items)
  db/                 Drizzle schema for every table (./schema), the Postgres client (./client),
                      the Redis connection (./redis) and the drizzle-kit migrations
  ui/                 Shared React components
  eslint-config/      Shared flat ESLint configs
  typescript-config/  Shared tsconfig bases
  vitest-config/      Shared Vitest presets (node / react)
```

`apps/*` are deployable units — each one runs as its own process. `packages/*` are internal, unpublished libraries consumed via pnpm's `workspace:*` protocol and scoped under `@resonory/*`. Apps stay unscoped (`web`, `api`, `worker`) since nothing else depends on them.

Internal packages use **Just-in-Time (JIT) compilation** — they export TypeScript source directly (see each package's `exports` field in `package.json`), never compiled to JS themselves. `apps/web` (Next.js's own bundler) and `apps/api`/`apps/worker` in dev (`tsx`, esbuild-based) transpile that source on the fly, so no build step is needed just to _consume_ `@resonory/db` from `apps/api`, for example.

That's fine for anything bundler-based — but plain `node` cannot execute raw TypeScript at all (Node 20's native TS support doesn't exist; it landed in Node 22.6+/23.6+, and even then doesn't handle decorators). So `apps/api`'s and `apps/worker`'s **production** builds don't use plain `tsc` — they use [`tsup`](https://tsup.egoist.dev) (an esbuild-based bundler) via each app's `tsup.config.ts`, with `noExternal: [/^@resonory\//]` forcing the JIT workspace packages to be inlined into the output, while real npm dependencies (`fastify`, `drizzle-orm`, etc.) stay external via `skipNodeModulesBundle`. This mirrors exactly what `tsx` already does correctly in dev — same underlying esbuild resolution, just producing a deployable bundle instead of running a watcher. Two real, verified gotchas from building this: transitive npm packages used only _inside_ a bundled workspace package (`ioredis`, `postgres` and `zod` through `@resonory/db`) had to be explicitly added to the consuming app's own `dependencies` too, since pnpm's strict `node_modules` isolation means they're otherwise only resolvable from the original package's own scope, not the app's; and `apps/api` deliberately leaves `emitDecoratorMetadata` off (esbuild can't emit it), so every constructor parameter of an `@injectable()` class names its dependency with `@inject(TOKENS.X)`.

`packages/*` themselves stay JIT — no `build` script, not independently cached by Turborepo the way `apps/api`'s/`apps/worker`'s own `build` task is. Only the three deployable apps have real `build` scripts (`tsup` for api/worker, `next build` for web).

## Why this split

- **`apps/api`** holds all of the API's code, organised by layer rather than by feature ([ADR 0004](./adr/0004-layer-first-apps-with-use-case-classes-and-a-di-container.md)): `domain/` for the Auth and Items entities, ports, errors and rules; `application/` for the use cases (`AdmitSignInUseCase`, `ResolveSignedInUserUseCase`, `GetMeUseCase`) and their output DTOs (`MeOutput`, `ItemCardOutput`); `interface/` for the routes, controllers and middleware; `infrastructure/` for Better Auth (`createAuth`, `BetterAuthSessionProvider`), the Drizzle repositories and the row mappers; and `di/` for the container that wires them. Google sign-in through [Better Auth](https://better-auth.com) runs here ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md)). See [Clean Architecture](./clean-architecture.md) for each layer and the dependency rule.
- **`packages/shared`** defines every request and response between `apps/web` and `apps/api` once, as zod schemas, so the two can't drift apart (see [ADR 0001](./adr/0001-shared-zod-contracts-package.md)). Its only dependency is `zod`, and it never imports domain, persistence or framework code, so the web app never pulls in server packages. It has one entry point per context: `@resonory/shared/schemas/common` (the error response and the `paginated(schema)` helper), `@resonory/shared/schemas/auth` (the signed-in User returned by `GET /me`), and `@resonory/shared/schemas/items` (the Item card with its Tags and who applied each, the list query and paginated list response, and the create-Item input and response). Schemas end in `Schema` and their inferred types drop the suffix (`ItemCardSchema` / `ItemCard`); a plain `Item` is always the domain entity. The API validates what it receives and filters what it sends through these schemas, and the web app's API helpers (`apps/web/src/lib/api.ts`) parse every response with them and throw on a mismatch. The API's application layer owns the explicit mapping from its entities to these shapes (for Items, `toItemCardOutput` in `apps/api/src/application/dto/items/ItemCardOutput.ts`).
- **`packages/db`** is shared infrastructure, not a feature. It declares the Drizzle schema for every table (`@resonory/db/schema`), builds the raw Postgres client (`@resonory/db/client`) and Redis connection (`@resonory/db/redis`) once rather than letting each caller open its own pool, and is the single drizzle-kit migration runner, since one Postgres database has one migration history spanning every context's tables. It knows nothing about the domain: the API's adapters import its tables and map rows to entities.

## Tech stack

**Language & runtime**: TypeScript, Node.js ≥20

**Package management & orchestration**: pnpm (workspaces), Turborepo

**Frontend** (`apps/web`): Next.js (App Router, Turbopack dev server), React, React DOM

**Backend API** (`apps/api`): Fastify, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, Zod (validation via `fastify-type-provider-zod`), Better Auth, `tsx` (dev runtime), `tsup` (build)

**Worker** (`apps/worker`): BullMQ (consumes the Items queue), InversifyJS + `reflect-metadata`, `tsx` (dev runtime), `tsup` (build)

**Dependency injection** (`apps/api`, `apps/worker`): InversifyJS + `reflect-metadata`, one container per app in `src/di/container.ts` — see [Clean Architecture](./clean-architecture.md)

**Database** (schema and migrations in `packages/db`, queries in `apps/api`'s infrastructure layer): Drizzle ORM, drizzle-kit (migrations/studio CLI), `postgres` (postgres.js driver), PostgreSQL 16 (Docker)

**Redis** (connection in `packages/db`): ioredis, Redis 7 (Docker); today it backs the API's rate-limit store

**Linting**: ESLint 9 (flat config), `typescript-eslint`, `eslint-config-next`, `eslint-config-prettier`

**Formatting**: Prettier 3

**Local infra**: Docker Compose (Postgres + Redis)

See [Code Quality](./code-quality.md) for how lint/format/type-check are wired together, and [Getting Started](./getting-started.md) for running everything locally.

## Architectural pattern

This project follows **Clean Architecture** (ports-and-adapters), strictly and as a standing convention for every future change — not just the current code. Dependencies point inward only: infrastructure (Fastify, Better Auth, Drizzle) depends on the use-case layer, never the reverse, and a lint rule stops `domain/` and `application/` from importing framework or database code. See [Clean Architecture](./clean-architecture.md) for the full layer breakdown, the dependency rule, and where new code should go.

This wasn't the original design. The project started with routes calling Drizzle/BullMQ directly, a deliberate simplification for early v1 scope, then moved through a stage organised by technical layer across packages, then through feature packages that each held their own domain, use cases and adapters. Those were dissolved into `apps/api`'s layers ([ADR 0004](./adr/0004-layer-first-apps-with-use-case-classes-and-a-di-container.md)), with the shared infrastructure (Drizzle schema, migrations, Postgres and Redis connections) in one `packages/db`. `apps/api/src/di/container.ts` is the composition root: it binds every port to its adapter, and the routes and controllers stay thin, only calling use cases.
