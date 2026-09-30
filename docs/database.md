# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team) via the `postgres` (postgres.js) driver. Schema is owned by each feature package (`packages/items/src/infrastructure/persistence/schema`, `packages/auth/src/infrastructure/persistence/schema`); `packages/db/schema.ts` re-exports both as the single input drizzle-kit generates migrations from. The raw connection (`pgClient`) lives in `packages/shared-kernel/src/db/client.ts`; each feature package wraps it in its own local `drizzle(pgClient, { schema })` call.

## Schema

The schema is being redesigned from scratch. Right now only the better-auth tables (`users`, `sessions`, `accounts`, `verifications`) are defined in code, in `packages/auth/src/infrastructure/persistence/schema`. `packages/items` declares no tables yet (the tags design is tracked in issue #11). There are no migrations in `packages/db/migrations/` either: the first migration generated from the new design will be a fresh `0000`.

Conventions for new tables: `uuid` primary keys with `defaultRandom()`, snake_case column names, `timestamptz NOT NULL DEFAULT now()` timestamps, and `onDelete: "cascade"` on foreign keys to `users.id`. A feature package references `users` by importing the table object from `@cue-memory/auth/schema`, which is a schema-only dependency, not a runtime one (see [Clean Architecture](./clean-architecture.md#shared-infrastructure)).

## Migration workflow

Drizzle Kit is configured in `packages/db/drizzle.config.ts`, pointed at `packages/db/schema.ts` (a thin re-export shim over `@cue-memory/items/schema` + `@cue-memory/auth/schema`) and outputting to `./migrations`.

`packages/db` has no `src/` directory — it's not a feature package, just the migration runner. `migrations/` stays a top-level directory (a sibling of `schema.ts`) since generated SQL files aren't TypeScript source. **Unlike most generated output in this repo (`dist/`, `.next/`), migrations are tracked in git** — they're history, not a build artifact; losing them means losing the ability to reproduce the schema from scratch on a new environment. `.prettierignore` still excludes `packages/db/migrations/` so Prettier doesn't reformat drizzle-kit's own generated `meta/*.json` bookkeeping on every `pnpm format`, but that's a formatting exclusion, not a git one.

```bash
pnpm db:generate   # diff the schema against the last migration, write a new SQL migration file
pnpm db:migrate    # apply all pending migrations to DATABASE_URL
pnpm db:studio     # open Drizzle Studio, a local DB browser/editor
pnpm db:reset      # LOCAL ONLY: drop every table, enum and drizzle's migration history
```

`db:reset` (`packages/db/scripts/reset.ts`) drops and recreates the `public` schema and drops the `drizzle` schema, in one transaction. It refuses to run unless the `DATABASE_URL` host is `localhost`, `127.0.0.1` or `::1`. After a reset, `pnpm db:migrate` rebuilds the database from whatever is in `packages/db/migrations/`.

These are all `turbo run <task> --filter=@cue-memory/db` under the hood (see root `package.json`). Requires `packages/db/.env` to be set — see [Environment Variables](./environment-variables.md).

**Workflow when you change the schema**: edit the owning feature package's `schema/` files (`packages/items/...` or `packages/auth/...`) → `pnpm db:generate` (review the generated SQL in `packages/db/migrations/`) → `pnpm db:migrate` → commit the new migration files alongside the schema change. Never hand-edit generated migration files after they've been applied anywhere — generate a new one instead.

## Querying from apps

Per [Clean Architecture](./clean-architecture.md), `apps/api` and `apps/worker` never import `packages/db`, Drizzle, or schema tables directly — only a feature's own repository does (e.g. `packages/items/src/infrastructure/persistence/drizzle-item-repository.ts`). It implements the `ItemRepository` port interface defined in that same feature's `domain/ports`, and is the only place Drizzle query syntax appears for the items domain:

```ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgClient } from "@cue-memory/shared-kernel/db";
import type { ItemRepository } from "../../domain/ports/item-repository";
import * as schema from "./schema";
import { items } from "./schema/items";

const db = drizzle(pgClient, { schema });

export class DrizzleItemRepository implements ItemRepository {
  async updateStatus(itemId: string, status: ItemStatus) {
    await db.update(items).set({ status }).where(eq(items.id, itemId));
  }
  // ...
}
```

The repository is also responsible for translating Drizzle's raw row shape into the domain entities `@cue-memory/types` declares — e.g. converting `createdAt` from Drizzle's native `Date` to the `string` the `Item` entity expects, and flattening the `itemsToTags`/`itemsToCollections` join-table rows into the `tags`/`collections` arrays `ItemWithRelations` actually declares. `apps/api` and `apps/worker` each instantiate `DrizzleItemRepository` once, in their own `src/composition.ts`, and pass it into use cases from `@cue-memory/items`.
