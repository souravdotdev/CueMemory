# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team) via the `postgres` (postgres.js) driver. Schema is owned by each feature package (`packages/items/src/infrastructure/persistence/schema`, `packages/auth/src/infrastructure/persistence/schema`); `packages/db/schema.ts` re-exports both as the single input drizzle-kit generates migrations from. The raw connection (`pgClient`) lives in `packages/shared-kernel/src/db/client.ts`; each feature package wraps it in its own local `drizzle(pgClient, { schema })` call.

## Schema

The schema is being redesigned from scratch. The Auth context's tables are defined in `packages/auth/src/infrastructure/persistence/schema`, and they make up the redesign's first migration, `packages/db/migrations/0000_create_auth_tables.sql`. `packages/items` declares the `items` table (with the `item_type` and `item_status` enums) in `packages/items/src/infrastructure/persistence/schema/items.ts`; it is created by the second migration, `packages/db/migrations/0001_create_items_table.sql`. The third migration, `packages/db/migrations/0002_remove_failure_reason.sql`, drops the free-text `failure_reason` column and its `items_failure_reason_iff_failed` check: why an Item failed is not stored, the worker logs it with the Item id, and every Failed Item shows the same generic message. The fourth migration, `packages/db/migrations/0003_create_tags_and_item_tags.sql`, creates the `tag_source` enum and the `tags` and `item_tags` tables (issue #11), declared in `packages/items/src/infrastructure/persistence/schema/tags.ts`. The fifth migration, `packages/db/migrations/0004_create_accounts_table.sql`, creates the `accounts` table (issue #27), declared alongside the other Auth tables. The sixth migration, `packages/db/migrations/0005_add_items_search_vector.sql`, adds the generated `search_vector` column and its GIN index to `items` (issue #28).

| Table           | Owner            | Purpose                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`         | `packages/auth`  | `id`, `name`, `email` (unique), `email_verified`, `profile_img` (nullable; Drizzle key `image`, per better-auth's adapter contract), `created_at`, `updated_at`, `deleted_at` (nullable soft-delete marker, see below)                                                                                                                                  |
| `sessions`      | `packages/auth`  | better-auth sessions: `user_id` (FK to `users.id`, cascade), `token` (unique), `expires_at`, `ip_address`, `user_agent`, timestamps                                                                                                                                                                                                                     |
| `accounts`      | `packages/auth`  | better-auth's account model, one row per Sign-in identity: `user_id` (FK to `users.id`, cascade), `account_id` (the provider's id for the identity, e.g. Google's `sub`), `provider_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password` (unused; null with Google), timestamps |
| `verifications` | `packages/auth`  | better-auth verification tokens: `identifier`, `value`, `expires_at`, timestamps                                                                                                                                                                                                                                                                        |
| `items`         | `packages/items` | Saved Items: `id`, `user_id` (FK to `users.id`, cascade), `source_url`, `type` (`item_type`, nullable while Processing), `status` (`item_status`, default `processing`), `title`, `description`, `thumbnail_key` (object-storage key, not a URL), `extracted_text`, timestamps, `search_vector` (generated keyword-search vector, see below)            |
| `tags`          | `packages/items` | A User's private, flat Tags: `id`, `user_id` (FK to `users.id`, cascade), `name` (the canonical slug; no separate display name), timestamps                                                                                                                                                                                                             |
| `item_tags`     | `packages/items` | Tag links: `item_id`, `tag_id`, `user_id` (denormalized, only for the same-owner foreign keys), `source` (`tag_source`), `created_at`; no surrogate id and no `updated_at`                                                                                                                                                                              |

`users.deleted_at` is the soft-delete marker: a deleted User stays in the table for a 30-day grace period before it's purged (see [ADR 0001](../packages/auth/docs/adr/0001-soft-delete-users-with-30-day-restore.md)). The partial index `users_deleted_at_idx` (`WHERE deleted_at IS NOT NULL`) lets the purge job find deleted Users without indexing active ones.

Enums: `item_type` (`article`, `tweet`, `video`, `image`, `pdf`, `link`; new Item types are added by extending it), `item_status` (`processing`, `ready`, `failed`) and `tag_source` (`ai`, `user`: who applied a Tag to an Item, recorded per link rather than per Tag). Each enum's values are defined once in the Items domain (`ITEM_TYPES`, `ITEM_STATUSES`, `TAG_SOURCES`) and imported by its `pgEnum`.

`items` enforces the Item lifecycle with check constraints: `items_type_set_when_finished` (a Ready or Failed Item has a `type`) and `items_source_url_http` (`source_url` must start with `http://` or `https://`, case-insensitive). The unique constraint `items_id_user_id_unique` on (`id`, `user_id`) lets tag links (#11) require an Item and a tag to belong to the same User, and the index `items_user_id_created_at_idx` on (`user_id`, `created_at DESC`) serves a User's newest-first feed and per-User counts.

`items.search_vector` is a `tsvector` that Postgres generates and stores (`GENERATED ALWAYS AS ... STORED`), so no write path can forget to update it. It uses the `english` configuration, so word forms match ("running" finds "run"), and weights a title match (A) above a description match (B) above an extracted-text match (C). Only the first 100,000 characters of `extracted_text` are indexed (`MAX_INDEXED_TEXT_LENGTH`), which keeps the vector well under Postgres's 1 MB tsvector limit so a very long Item never fails to save. The GIN index `items_search_vector_idx` serves keyword search. The column is a database search detail: `toItem` takes the row without it, and the domain `Item` never carries it.

`accounts` is read and written only by better-auth; no domain entity maps it. The unique constraint `accounts_provider_id_account_id_unique` on (`provider_id`, `account_id`) means one provider identity belongs to exactly one User (the same `account_id` under a different provider is a different identity), and `accounts_user_id_idx` serves lookups of a User's Sign-in identities. Deleting a User cascades to their `accounts` rows.

`tags` enforces Tag names and ownership:

- `tags_name_is_slug` checks that `name` matches `^[a-z0-9+#.]+(-[a-z0-9+#.]+)*$` and is at most 50 characters. It is a backstop for `slugifyTagName` in the Items domain: the regex and the limit are built from the domain's `TAG_NAME_PATTERN` and `MAX_TAG_NAME_LENGTH`, and a unit test checks that every slug `slugifyTagName` produces matches the pattern.
- `tags_user_id_name_unique` on (`user_id`, `name`) gives each name one Tag within a User's Tags; the same name is allowed for different Users. Renaming onto an existing name fails on this constraint.
- `tags_id_user_id_unique` on (`id`, `user_id`) is the target for the `item_tags` same-owner foreign key.

`item_tags` has the primary key (`item_id`, `tag_id`) and two composite foreign keys that share its `user_id` column, so a link can never join one User's Item to another User's Tag:

- `item_tags_item_id_user_id_items_fk`: (`item_id`, `user_id`) references `items` (`id`, `user_id`), on delete cascade. Deleting an Item removes its links but keeps the Tags, including Tags left with no Items.
- `item_tags_tag_id_user_id_tags_fk`: (`tag_id`, `user_id`) references `tags` (`id`, `user_id`), on delete cascade. Deleting a Tag removes its links.

Deleting a User cascades to their Tags and Items, and so to all their links. The index `item_tags_tag_id_idx` serves "every Item with this Tag"; lookups by `item_id` use the primary key.

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

The repository is also responsible for translating Drizzle's raw row shape into the domain entities each feature declares (e.g. `toItem` turns an `items` row into the domain `Item`, keeping dates as `Date`). Turning an entity into a wire shape is not the repository's job: that happens in the feature's presentation layer, against the contracts in `packages/contracts`. `apps/api` and `apps/worker` each instantiate `DrizzleItemRepository` once, in their own `src/composition.ts`, and pass it into use cases from `@cue-memory/items`.
