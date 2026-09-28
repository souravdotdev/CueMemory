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

- **Postgres 16** on `localhost:5433` (db `universal_save`, user/pass `postgres`/`postgres`)
- **Redis 7** on `localhost:6380`

Stop them with `docker compose down` (add `-v` to also drop the Postgres volume and reset data).

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

## Running the apps

```bash
pnpm dev
```

Runs `dev` in every app in parallel via Turborepo (`apps/web` on Next.js's default port, `apps/api` on `PORT` from its env, `apps/worker` with no HTTP server — it just consumes the queue). Turborepo's terminal UI (`"ui": "tui"` in `turbo.json`) shows all three side by side.

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

`apps/api`/`apps/worker`'s `start` script (`node dist/index.js`) now actually works — `pnpm build` bundles them with `tsup` rather than emitting raw `tsc` output, specifically to solve two compounding problems plain `tsc` couldn't: Node's ESM resolver needs explicit `.js` extensions on relative imports (which the source doesn't have), and every `@cue-memory/*` workspace package is plain TypeScript that was never compiled — plain `node` can't execute it at all, only bundler-based tools (`tsx` in dev, `tsup` in production) can. See [Architecture](./architecture.md#monorepo-layout) for the full explanation.

## Smoke-testing the save flow end to end

1. `docker compose up -d`
2. Configure and apply `.env` + migrations as above
3. `pnpm --filter api dev` and `pnpm --filter worker dev` in separate terminals
4. `POST /items` with a JSON body `{ "url": "https://example.com/some-article" }` and header `x-user-id: <a real user id in the users table>` — see [API](./api.md)
5. The worker picks the job off the queue, fetches metadata (currently stubbed), and flips the item's status to `ready`
6. `GET /items` with the same `x-user-id` header returns the processed item — or start `apps/web` and see it on the feed page directly
