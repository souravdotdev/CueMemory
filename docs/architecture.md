# Architecture

## Monorepo layout

Managed with [pnpm workspaces](https://pnpm.io/workspaces) + [Turborepo](https://turborepo.com). Two top-level groups:

```
apps/
  web/      Next.js frontend (feed + save-a-link pages)
  api/      Fastify ingestion API
  worker/   BullMQ consumer that processes saved items

packages/
  items/              Feature package: the paste-a-link save/list/process flow —
                      domain/application/infrastructure/presentation all nested inside
  auth/               Feature package: User entity + auth DB schema (minimal — no
                      use cases/routes exist yet, see Clean Architecture)
  shared-kernel/      Raw cross-feature infra: Postgres client, Redis connection
  db/                 Centralized Drizzle-kit migration runner (schema.ts re-exports
                      items'/auth's schemas; no runtime code of its own)
  types/              Shared domain entities (Item, Tag, Collection, Reminder, ...)
  ui/                 Shared React components
  eslint-config/      Shared flat ESLint configs
  typescript-config/  Shared tsconfig bases
  vitest-config/      Shared Vitest presets (node / react)
```

`apps/*` are deployable units — each one runs as its own process. `packages/*` are internal, unpublished libraries consumed via pnpm's `workspace:*` protocol and scoped under `@second-brain/*`. Apps stay unscoped (`web`, `api`, `worker`) since nothing else depends on them.

Internal packages use **Just-in-Time (JIT) compilation** — they export TypeScript source directly (see each package's `exports` field in `package.json`), never compiled to JS themselves. `apps/web` (Next.js's own bundler) and `apps/api`/`apps/worker` in dev (`tsx`, esbuild-based) transpile that source on the fly, so no build step is needed just to _consume_ `@second-brain/db` from `apps/api`, for example.

That's fine for anything bundler-based — but plain `node` cannot execute raw TypeScript at all (Node 20's native TS support doesn't exist; it landed in Node 22.6+/23.6+, and even then doesn't handle decorators). So `apps/api`'s and `apps/worker`'s **production** builds don't use plain `tsc` — they use [`tsup`](https://tsup.egoist.dev) (an esbuild-based bundler) via each app's `tsup.config.ts`, with `noExternal: [/^@second-brain\//]` forcing the JIT workspace packages to be inlined into the output, while real npm dependencies (`fastify`, `drizzle-orm`, etc.) stay external via `skipNodeModulesBundle`. This mirrors exactly what `tsx` already does correctly in dev — same underlying esbuild resolution, just producing a deployable bundle instead of running a watcher. Two real, verified gotchas from building this: transitive npm packages used only _inside_ a bundled workspace package (`ioredis`, `bullmq`, `postgres`, `zod`) had to be explicitly added to the consuming app's own `dependencies` too, since pnpm's strict `node_modules` isolation means they're otherwise only resolvable from the original package's own scope, not the app's; and `import type` (not `import { Type }`) is required for type-only imports in any file using `@injectable()` + `emitDecoratorMetadata`, since tsup's SWC-based decorator transform can otherwise strip an import in a way that breaks esbuild's export resolution.

`packages/*` themselves stay JIT — no `build` script, not independently cached by Turborepo the way `apps/api`'s/`apps/worker`'s own `build` task is. Only the three deployable apps have real `build` scripts (`tsup` for api/worker, `next build` for web).

## Why this split

- **`packages/types`** has zero dependencies and is imported by both the frontend and backend, so request/response shapes for the paste-a-link flow can't drift out of sync between `apps/web` and `apps/api`.
- **`packages/items`** is a feature package — it holds the actual business logic (use cases), the port interfaces infrastructure must implement, and the concrete adapters (Drizzle repository, BullMQ queue, metadata fetcher) and delivery mechanisms (HTTP routes, job processor) that implement/expose them. See [Clean Architecture](./clean-architecture.md) for the full per-feature layering.
- **`packages/auth`** is a feature package too, currently minimal — just the `User` entity and its DB schema, since no auth port/use-case/route exists yet.
- **`packages/shared-kernel`** exists so the raw Postgres/Redis connections are built once and shared by whichever feature packages need them, rather than each feature opening its own pool against the same database/Redis instance.
- **`packages/db`** is not a feature package — it's the single centralized Drizzle-kit migration runner, since one Postgres database has one migration history spanning every feature's tables.

## Tech stack

**Language & runtime**: TypeScript, Node.js ≥20

**Package management & orchestration**: pnpm (workspaces), Turborepo

**Frontend** (`apps/web`): Next.js (App Router, Turbopack dev server), React, React DOM

**Backend API** (`apps/api`): Fastify, `@fastify/cors`, Zod (validation), `tsx` (dev/build runtime)

**Worker** (`apps/worker`): BullMQ, `tsx`

**Dependency injection** (`apps/api`, `apps/worker`, and the concrete adapters in `packages/items`): InversifyJS + `reflect-metadata` — see [Clean Architecture](./clean-architecture.md#the-composition-roots)

**Database** (`packages/items`' infrastructure, migrations run via `packages/db`): Drizzle ORM, drizzle-kit (migrations/studio CLI), `postgres` (postgres.js driver), PostgreSQL 16 (Docker)

**Queue** (`packages/items`' infrastructure): BullMQ, ioredis, Redis 7 (Docker)

**Linting**: ESLint 9 (flat config), `typescript-eslint`, `eslint-config-next`, `eslint-config-prettier`

**Formatting**: Prettier 3

**Local infra**: Docker Compose (Postgres + Redis)

See [Code Quality](./code-quality.md) for how lint/format/type-check are wired together, and [Getting Started](./getting-started.md) for running everything locally.

## Architectural pattern

This project follows **Clean Architecture** (ports-and-adapters), strictly and as a standing convention for every future change — not just the current code. Dependencies point inward only: infrastructure (Fastify routes, Drizzle, BullMQ) depends on the use-case layer, never the reverse. See [Clean Architecture](./clean-architecture.md) for the full layer breakdown, the dependency rule, and where new code should go.

This wasn't the original design — the project started with routes calling Drizzle/BullMQ directly, a deliberate simplification for early v1 scope, then moved through an intermediate stage organized by technical layer (`packages/core`/`db`/`queue`) before settling on today's feature-first packages once the number of features and the need for stricter per-feature boundaries grew. Each feature package (`packages/items`, `packages/auth`) holds its own business logic, port interfaces, and concrete adapters; `apps/api` and `apps/worker` each have a `src/composition.ts` composition root that wires concrete adapters into the use cases, and their route handlers / job processors are thin controllers that only call use cases.
