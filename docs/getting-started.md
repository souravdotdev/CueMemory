# Getting Started

## Prerequisites

- Node.js ≥20
- pnpm (`corepack enable` or install directly — root `package.json` pins `packageManager: pnpm@10.13.1`)
- Docker (for local Postgres + Redis)

## Install

```bash
pnpm install
```

Installs dependencies for every app and package in one pass via pnpm workspaces.

## Local services

Postgres and Redis run via Docker Compose, on non-default ports (`5433`/`6380` instead of `5432`/`6379`) to avoid clashing with other local projects:

```bash
docker compose up -d
```

This starts:

- **Postgres 16** on `localhost:5433` (db `resonory`, user/pass `postgres`/`postgres`)
- **Redis 7** on `localhost:6380`

Stop them with `docker compose down` (add `-v` to also drop the Postgres volume and reset data).

### Switching from the old database name

If you set up local services before the database was renamed from `cue_memory` to `resonory`, your containers still run under the old Compose project. To move over (this starts you on an empty database):

1. `docker compose -p cue-memory down` — stop the old containers
2. `docker compose up -d` — starts the new ones, with a new, empty `resonory_postgres-data` volume
3. Change the database name at the end of `DATABASE_URL` from `cue_memory` to `resonory` in `apps/api/.env`, `apps/worker/.env` and `packages/db/.env`
4. `pnpm db:migrate` — apply the migrations to the new database
5. Optional: `docker volume rm cue-memory_postgres-data` — delete the old volume and its data

## Environment variables

Each app/package that needs config has its own `.env` (see [Environment Variables](./environment-variables.md) for the full reference and which values go where). Set these up before running anything that touches the database or queue.

## Database setup

Once Postgres is running and `packages/db`'s env is configured:

```bash
pnpm db:generate   # generate a migration from the current Drizzle schema
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # optional: browse the database in Drizzle Studio
```

See [Database](./database.md) for the schema itself and the full migration workflow.

## Thumbnail storage

Thumbnails are kept in Supabase Storage, in the same Supabase project as the dev database. It's optional: without it the worker runs and Items simply have no Thumbnails. To turn it on, create the bucket **once** in the dev project (the worker never creates it):

1. In the Supabase dashboard, open **Storage → New bucket**.
2. Name it `thumbnails` and leave **Public bucket** off: it must be private (the API hands out signed links).
3. No policies are needed: the worker uploads with the service role key, which bypasses row-level security.

Or, in the SQL editor:

```sql
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', false);
```

Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/worker/.env` (see [Environment Variables](./environment-variables.md#appsworkerenv)). Thumbnails land at `thumbnails/{userId}/{itemId}.webp`.

## Running the apps

```bash
pnpm dev
```

Runs `dev` in every app in parallel via Turborepo (`apps/web` on Next.js's default port, `apps/api` on `PORT` from its env, `apps/worker` with no HTTP server, loading `apps/worker/.env` and consuming the Items queue). Turborepo's terminal UI (`"ui": "tui"` in `turbo.json`) shows all three side by side.

To run just one app: `pnpm --filter web dev` (or `api`, `worker`).

## Other common commands

```bash
pnpm build         # production build for every app (tsup for api/worker, next build for web)
pnpm lint          # eslint across every package
pnpm check-types   # tsc --noEmit across every package
pnpm test          # vitest run across every package — see docs/testing.md
pnpm format        # prettier --write across the repo
pnpm format:check  # prettier --check (CI-style, no writes)
```

All of these (except `format`/`format:check`, which run Prettier directly rather than through Turborepo — see [Code Quality](./code-quality.md)) are Turborepo tasks, so results are cached and only re-run for packages whose inputs actually changed.

These same checks (plus commit-message linting) also run automatically in CI on every push and PR — see [Code Quality](./code-quality.md#continuous-integration).

`apps/api`/`apps/worker`'s `start` script (`node dist/index.js`) now actually works — `pnpm build` bundles them with `tsup` rather than emitting raw `tsc` output, specifically to solve two compounding problems plain `tsc` couldn't: Node's ESM resolver needs explicit `.js` extensions on relative imports (which the source doesn't have), and every `@resonory/*` workspace package is plain TypeScript that was never compiled — plain `node` can't execute it at all, only bundler-based tools (`tsx` in dev, `tsup` in production) can. See [Architecture](./architecture.md#monorepo-layout) for the full explanation.

## Smoke-testing the API

What runs today is auth, saving a URL and detecting its Item type from the URL (see [Queue](./queue.md)):

1. `docker compose up -d`
2. Configure and apply `.env` + migrations as above, including the Google OAuth client from [Environment Variables](./environment-variables.md)
3. `pnpm --filter api dev`
4. `curl http://localhost:4000/health` returns `{ "status": "ok" }`, and `curl http://localhost:4000/me` returns `401` in the `unauthorized` error envelope — see [API](./api.md)
5. Sign in with Google through `POST /api/auth/sign-in/social`, then `GET /me` with the Session cookie returns the signed-in User
6. `POST /items` with the Session cookie and `{ "url": "https://youtu.be/dQw4w9WgXcQ" }` returns `201` with a Processing Item card. With the worker running (`pnpm --filter worker dev`), the Item is `ready` with type `video` within seconds and the worker logs `[worker] Item <id> is Ready as video`
