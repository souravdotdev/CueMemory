# Environment Variables

Each app/package that needs configuration has its own local `.env` file — there is deliberately no single root-level `.env` (see [Architecture](./architecture.md) and the "why not one shared file" reasoning below). `.env` is gitignored everywhere; nothing here should ever be committed.

## Validation

Every app/package that reads `process.env` validates it through a Zod schema in its own `src/env.ts`, rather than reading `process.env.X` directly wherever it's needed. Each one calls `schema.safeParse(...)` and throws one formatted error listing every missing/invalid variable if validation fails, instead of failing later with a confusing runtime error (e.g. a Postgres client throwing on a malformed connection string) or silently limping along with `undefined`.

- `packages/db/src/postgres/env.ts` — `DATABASE_URL` must be a valid URL. Used by `postgres/client.ts` and `packages/db/drizzle.config.ts`.
- `packages/db/src/redis/env.ts` — `REDIS_URL` must be a valid URL. Used by `redis/connection.ts`. Exported as a separate subpath (`@cue-memory/db/redis`) from the DB env, specifically so importing one doesn't force-validate the other.
- `apps/api/src/env.ts` — `PORT` (coerced to a number, defaults to `4000`), `HOST` (the interface to bind to, defaults to `0.0.0.0`) and the auth configuration: `BETTER_AUTH_SECRET` (at least 32 characters), `BETTER_AUTH_URL` (an http(s) URL), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (non-empty), `WEB_ORIGIN` (a bare http(s) origin: no path, no trailing slash) and the optional `AUTH_COOKIE_DOMAIN`, plus the optional Thumbnail storage pair `SUPABASE_URL` (an http(s) URL) and `SUPABASE_SERVICE_ROLE_KEY`, where an empty value counts as unset and Thumbnails are on only when both are set. Every one except `PORT`, `HOST`, `AUTH_COOKIE_DOMAIN` and the Supabase pair is required, with no default, so a misconfigured deploy refuses to start (`tests/unit/env.test.ts`). `WEB_ORIGIN` replaced the old `CORS_ORIGIN`: it's both the only CORS origin and Better Auth's only trusted origin (see [Security](./security.md)). The container binds the parsed `env` under `TOKENS.Env`, and code reads it from there rather than from `process.env`. `DATABASE_URL`/`REDIS_URL` aren't re-validated here — importing `@cue-memory/db/client`/`@cue-memory/db/redis` (transitively, via `src/infrastructure/database/db.ts` and `src/rate-limit-redis.ts`, both imported only by the container) already validates them at import time, so `apps/api` inherits that check for free, and tests that never build the production container need neither variable.
- `apps/worker` — no `env.ts` of its own: it reads `DATABASE_URL` and `REDIS_URL` through `@cue-memory/db`'s `client`/`redis` subpaths (via `src/infrastructure/database/db.ts` and the container), both of which validate themselves at import time. The optional Supabase Storage pair is read by `src/infrastructure/storage/supabaseEnv.ts`, called only by the container, by the same rules as the API's: an empty value counts as unset, either one unset means no Thumbnail store, and a `SUPABASE_URL` that is set but isn't an http(s) URL refuses to start. Its `dev` script loads `apps/worker/.env` with `tsx --env-file=.env`, like the API's.
- `apps/web/src/env.ts` — `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`). Imported as a side effect in `next.config.ts` so an invalid value fails `next dev`/`next build` immediately, before anything else runs.

One Next.js-specific detail: `apps/web/src/env.ts` reads `process.env.NEXT_PUBLIC_API_URL` as a single literal expression rather than spreading the whole `process.env` object into `safeParse`. Next.js statically replaces `process.env.NEXT_PUBLIC_*` expressions with their literal value at build time for anything that ends up in the client bundle — spreading the whole object would defeat that replacement and crash in the browser, where `process` doesn't exist.

## `packages/db/.env`

| Variable       | Purpose                                     | Local dev value                                        |
| -------------- | ------------------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL` | Postgres connection string, used by Drizzle | `postgres://postgres:postgres@localhost:5433/resonory` |

Required for `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`, and any other direct use of `drizzle-kit` in this package.

## `apps/api/.env`

| Variable               | Purpose                                                                                                                                                                                                              | Local dev value                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `PORT`                 | Port the Fastify server listens on                                                                                                                                                                                   | `4000`                                                 |
| `HOST`                 | Interface the server binds to; defaults to `0.0.0.0` (every interface, for containers and hosts)                                                                                                                     | `127.0.0.1`                                            |
| `DATABASE_URL`         | Postgres connection string (via `@cue-memory/db/client`)                                                                                                                                                             | `postgres://postgres:postgres@localhost:5433/resonory` |
| `REDIS_URL`            | Redis connection string (via `@cue-memory/db/redis`, for the rate-limit store)                                                                                                                                       | `redis://localhost:6380`                               |
| `BETTER_AUTH_SECRET`   | Signs Sessions and encrypts Sign-in identities' OAuth tokens; at least 32 characters                                                                                                                                 | output of `openssl rand -base64 32`                    |
| `BETTER_AUTH_URL`      | The API's public URL; Google redirects back to `<BETTER_AUTH_URL>/api/auth/callback/google`                                                                                                                          | `http://localhost:4000`                                |
| `GOOGLE_CLIENT_ID`     | Google OAuth web client id                                                                                                                                                                                           | from Google Cloud Console                              |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret                                                                                                                                                                                       | from Google Cloud Console                              |
| `WEB_ORIGIN`           | The web app's origin: the only one allowed to call this API with credentials, and the only one Better Auth trusts                                                                                                    | `http://localhost:3000`                                |
| `AUTH_COOKIE_DOMAIN`   | Optional. The parent domain web and API share in production (`app.<domain>`/`api.<domain>`), which turns on cross-subdomain Session cookies ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md)) | unset                                                  |

For local sign-in, create a Google OAuth **web** client whose authorized redirect URI is `http://localhost:4000/api/auth/callback/google`.

Optional Thumbnail storage, read by the same rules as the worker. With either one unset (or empty), no Thumbnail provider is bound and every Item card's `thumbnailUrl` is `null`. With both set, the API signs 1-hour links into the private `thumbnails` bucket; a key Storage refuses to sign (missing object, bad service role key) gives that card a `null` `thumbnailUrl`:

| Variable                    | Purpose                                                                        | Local dev value                              |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| `SUPABASE_URL`              | The Supabase project URL, for Storage                                          | `https://<project-ref>.supabase.co` or unset |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (or secret) key; bypasses Storage row-level security, server only | from Supabase dashboard → API keys, or unset |

## `apps/worker/.env`

| Variable                    | Purpose                                                                                       | Local dev value                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`              | Postgres connection string, to update item status after processing                            | `postgres://postgres:postgres@localhost:5433/resonory`            |
| `REDIS_URL`                 | Redis connection string, to consume queued jobs                                               | `redis://localhost:6380`                                          |
| `SUPABASE_URL`              | Optional. The Supabase project's URL, for Thumbnails in Storage's private `thumbnails` bucket | `https://<project-ref>.supabase.co` (the dev project's)           |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. The project's service role key, which the worker uploads Thumbnails with            | from the Supabase dashboard (Project Settings → API Keys, secret) |

`DATABASE_URL` and `REDIS_URL` are required: the worker connects to Redis when it boots and refuses to start without either URL. It consumes the Items queue (see [Queue](./queue.md)). No `PORT` — the worker doesn't expose an HTTP server. `apps/worker/.env.example` lists all four.

The Supabase pair is optional, read by the same rules as the API: with either one unset (or empty), the worker still starts (it logs that Supabase Storage isn't configured), downloads no images, and every Item goes Ready without a Thumbnail. The bucket must exist before Thumbnails can be kept; the worker never creates it (see [Getting Started](./getting-started.md#thumbnail-storage)).

**The service role key belongs only on the server.** It bypasses Supabase's row-level security for the whole project, so it goes only in server-side `.env` files and the deploy's secret store: never in `apps/web`, never behind a `NEXT_PUBLIC_` prefix, never in a client bundle, a log or a commit (see [Security](./security.md#thumbnail-storage)).

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
