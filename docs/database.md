# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team) via the `postgres` (postgres.js) driver. Schema is owned by each feature package (`packages/items/src/infrastructure/persistence/schema`, `packages/auth/src/infrastructure/persistence/schema`); `packages/db/schema.ts` re-exports both as the single input drizzle-kit generates migrations from. The raw connection (`pgClient`) lives in `packages/shared-kernel/src/db/client.ts`; each feature package wraps it in its own local `drizzle(pgClient, { schema })` call.

## Schema

The schema is being redesigned from scratch. The Auth context's tables are defined in `packages/auth/src/infrastructure/persistence/schema`, and they make up the redesign's first migration, `packages/db/migrations/0000_create_auth_tables.sql`. `packages/items` declares the `items` table (with the `item_type` and `item_status` enums) in `packages/items/src/infrastructure/persistence/schema/items.ts`; it is created by the second migration, `packages/db/migrations/0001_create_items_table.sql`. The tags design is tracked in issue #11.

| Table           | Owner            | Purpose                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`         | `packages/auth`  | `id`, `name`, `email` (unique), `email_verified`, `profile_img` (nullable; Drizzle key `image`, per better-auth's adapter contract), `created_at`, `updated_at`, `deleted_at` (nullable soft-delete marker, see below)                                                                           |
| `sessions`      | `packages/auth`  | better-auth sessions: `user_id` (FK to `users.id`, cascade), `token` (unique), `expires_at`, `ip_address`, `user_agent`, timestamps                                                                                                                                                              |
| `verifications` | `packages/auth`  | better-auth verification tokens: `identifier`, `value`, `expires_at`, timestamps                                                                                                                                                                                                                 |
| `items`         | `packages/items` | Saved Items: `id`, `user_id` (FK to `users.id`, cascade), `source_url`, `type` (`item_type`, nullable while Processing), `status` (`item_status`, default `processing`), `title`, `description`, `thumbnail_key` (object-storage key, not a URL), `extracted_text`, `failure_reason`, timestamps |

`users.deleted_at` is the soft-delete marker: a deleted User stays in the table for a 30-day grace period before it's purged (see [ADR 0001](../packages/auth/docs/adr/0001-soft-delete-users-with-30-day-restore.md)). The partial index `users_deleted_at_idx` (`WHERE deleted_at IS NOT NULL`) lets the purge job find deleted Users without indexing active ones.

Enums: `item_type` (`article`, `tweet`, `video`, `image`, `pdf`, `link`; new Item types are added by extending it) and `item_status` (`processing`, `ready`, `failed`).

`items` enforces the Item lifecycle with check constraints: `items_type_set_when_finished` (a Ready or Failed Item has a `type`), `items_failure_reason_iff_failed` (`failure_reason` is set exactly when `status = 'failed'`) and `items_source_url_http` (`source_url` must start with `http://` or `https://`, case-insensitive). The unique constraint `items_id_user_id_unique` on (`id`, `user_id`) lets tag links (#11) require an Item and a tag to belong to the same User, and the index `items_user_id_created_at_idx` on (`user_id`, `created_at DESC`) serves a User's newest-first feed and per-User counts.

Conventions for new tables: `uuid` primary keys with `defaultRandom()`, snake_case column names, `timestamptz NOT NULL DEFAULT now()` timestamps (except nullable event markers such as `users.deleted_at`, which stay null until the event happens; see [ADR 0001](../packages/auth/docs/adr/0001-soft-delete-users-with-30-day-restore.md)), and `onDelete: "cascade"` on foreign keys to `users.id`. A feature package references `users` by importing the table object from `@cue-memory/auth/schema`, which is a schema-only dependency, not a runtime one (see [Clean Architecture](./clean-architecture.md#shared-infrastructure)).

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

**Workflow when you change the schema**: edit the owning feature package's `schema/` files (`packages/items/...` or `packages/auth/...`) → `pnpm --filter @cue-memory/db exec drizzle-kit generate --name <what_it_does>` (review the generated SQL in `packages/db/migrations/`) → `pnpm db:migrate` → commit the new migration files alongside the schema change. Never hand-edit generated migration files after they've been applied anywhere — generate a new one instead.

**Name every migration after what it does** (e.g. `0001_create_items_table`, `0002_create_tags_and_item_tags`) by passing `--name`, instead of keeping drizzle-kit's random names like `0001_right_electro`. A random name can still be fixed before the migration is committed: rename the `.sql` file and its `tag` in `meta/_journal.json`. Drizzle tracks applied migrations by content hash and timestamp, not by name.

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
