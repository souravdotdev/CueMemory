# Environment Variables

Each app/package that needs configuration has its own local `.env` file — there is deliberately no single root-level `.env` (see [Architecture](./architecture.md) and the "why not one shared file" reasoning below). `.env` is gitignored everywhere; nothing here should ever be committed.

## Validation

Every app/package that reads `process.env` validates it through a Zod schema in its own `src/env.ts`, rather than reading `process.env.X` directly wherever it's needed. Each one calls `schema.safeParse(...)` and throws one formatted error listing every missing/invalid variable if validation fails, instead of failing later with a confusing runtime error (e.g. a Postgres client throwing on a malformed connection string) or silently limping along with `undefined`.

- `packages/shared-kernel/src/db/env.ts` — `DATABASE_URL` must be a valid URL. Used by `db/client.ts` and `packages/db/drizzle.config.ts`.
- `packages/shared-kernel/src/redis/env.ts` — `REDIS_URL` must be a valid URL. Used by `redis/connection.ts`. Exported as a separate subpath (`@cue-memory/shared-kernel/redis`) from the DB env, specifically so importing one doesn't force-validate the other.
- `apps/api/src/env.ts` — `PORT` (coerced to a number, defaults to `4000`) and `CORS_ORIGIN` (must be a valid URL, defaults to `http://localhost:3000` — see [Security Middleware](./security.md)). `DATABASE_URL`/`REDIS_URL` aren't re-validated here — importing `@cue-memory/shared-kernel/db`/`@cue-memory/shared-kernel/redis` (transitively, via `@cue-memory/items`) already validates them at import time, so `apps/api` inherits that check for free.
- `apps/worker` — no `env.ts` of its own for the same reason: it only ever reads env vars indirectly through `@cue-memory/shared-kernel`'s `db`/`redis` subpaths, both of which validate themselves.
- `apps/web/src/env.ts` — `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`). Imported as a side effect in `next.config.ts` so an invalid value fails `next dev`/`next build` immediately, before anything else runs.

One Next.js-specific detail: `apps/web/src/env.ts` reads `process.env.NEXT_PUBLIC_API_URL` as a single literal expression rather than spreading the whole `process.env` object into `safeParse`. Next.js statically replaces `process.env.NEXT_PUBLIC_*` expressions with their literal value at build time for anything that ends up in the client bundle — spreading the whole object would defeat that replacement and crash in the browser, where `process` doesn't exist.

## `packages/db/.env`

| Variable       | Purpose                                     | Local dev value                                              |
| -------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL` | Postgres connection string, used by Drizzle | `postgres://postgres:postgres@localhost:5433/universal_save` |

Required for `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`, and any other direct use of `drizzle-kit` in this package.

## `apps/api/.env`

| Variable       | Purpose                                                                          | Local dev value                                              |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `PORT`         | Port the Fastify server listens on                                               | `4000`                                                       |
| `DATABASE_URL` | Postgres connection string (via `@cue-memory/shared-kernel/db`)                  | `postgres://postgres:postgres@localhost:5433/universal_save` |
| `REDIS_URL`    | Redis connection string (via `@cue-memory/shared-kernel/redis`, to enqueue jobs) | `redis://localhost:6380`                                     |
| `CORS_ORIGIN`  | The web app's origin — the only one allowed to call this API                     | `http://localhost:3000`                                      |

## `apps/worker/.env`

| Variable       | Purpose                                                            | Local dev value                                              |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL` | Postgres connection string, to update item status after processing | `postgres://postgres:postgres@localhost:5433/universal_save` |
| `REDIS_URL`    | Redis connection string, to consume queued jobs                    | `redis://localhost:6380`                                     |

No `PORT` — the worker doesn't expose an HTTP server, it just consumes the queue.

## `apps/web/.env`

| Variable              | Purpose                                           | Local dev value         |
| --------------------- | ------------------------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Base URL the frontend calls for the ingestion API | `http://localhost:4000` |

`NEXT_PUBLIC_*`-prefixed variables get inlined into the client-side JS bundle at build time — never put a secret behind that prefix.

## Duplication: `DATABASE_URL` / `REDIS_URL`

`DATABASE_URL` is duplicated across `packages/db`, `apps/api`, and `apps/worker`; `REDIS_URL` across `apps/api` and `apps/worker`. This is real duplication, not an oversight — all three point at the same Docker Compose services.

A single root `.env` was considered and intentionally not adopted, per Turborepo's own guidance against it:

- it creates implicit coupling (unclear which service actually consumes which variable)
- it produces coarse cache invalidation in Turborepo (any variable change would invalidate every task's cache, not just the tasks that actually use that variable)
- it would put `apps/web`'s `NEXT_PUBLIC_*` values (client-bundled) in the same file as database credentials (server-only)

If the duplication becomes painful, the documented middle ground is a single root `.env` for just the genuinely shared infra values (`DATABASE_URL`, `REDIS_URL`), loaded via `dotenv-cli` or Node's native `--env-file`, while `PORT` and `NEXT_PUBLIC_API_URL` stay app-local. Not implemented yet — flag it if you want it done.
