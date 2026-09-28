# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team) via the `postgres` (postgres.js) driver. Schema is owned by each feature package (`packages/items/src/infrastructure/persistence/schema`, `packages/auth/src/infrastructure/persistence/schema`); `packages/db/schema.ts` re-exports both as the single input drizzle-kit generates migrations from. The raw connection (`pgClient`) lives in `packages/shared-kernel/src/db/client.ts`; each feature package wraps it in its own local `drizzle(pgClient, { schema })` call.

## Schema

Matches the data model in the product plan (`product-plan.md`, section 9).

| Table                                   | Owner            | Purpose                                                                                                                                                                      |
| --------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                                 | `packages/auth`  | `id`, `email`, `createdAt` (plus better-auth internals: `emailVerified`, `name`, `updatedAt`)                                                                                |
| `sessions`, `accounts`, `verifications` | `packages/auth`  | better-auth's session/OAuth-account/verification-token tables — no application code reads these yet                                                                          |
| `items`                                 | `packages/items` | A saved thing: `type` (article/tweet/image/video/pdf/link), `sourceUrl`, `status` (processing/ready/failed), `title`, `thumbnailUrl`, `author`, `extractedText`, `createdAt` |
| `tags`                                  | `packages/items` | `name`, `isAiGenerated`, `createdAt`                                                                                                                                         |
| `collections`                           | `packages/items` | User-created folders: `userId`, `name`, `createdAt`                                                                                                                          |
| `reminders`                             | `packages/items` | `itemId`, `triggerAt`, `sentAt` (nullable — set once sent)                                                                                                                   |
| `items_to_tags`                         | `packages/items` | Join table, `items` ↔ `tags` (composite PK)                                                                                                                                  |
| `items_to_collections`                  | `packages/items` | Join table, `items` ↔ `collections` (composite PK)                                                                                                                           |

All primary keys are `uuid` with `defaultRandom()`. `items.userId` and `collections.userId` reference `users.id` with `onDelete: "cascade"` (a cross-package FK: `packages/items`' schema imports the `users` table object from `@second-brain/auth/schema` purely for this column reference — see [Clean Architecture](./clean-architecture.md#shared-infrastructure) for why that's a schema-only, not runtime, dependency); join-table foreign keys cascade on delete from either side.

Relations (Drizzle's `relations()` helper) are defined per-package, for tables that are actually queried relationally — e.g. `apps/api`'s `GET /items` uses `db.query.items.findMany({ with: { itemsToTags: { with: { tag: true } }, ... } })` rather than hand-written joins. `packages/auth`'s and `packages/items`' relation files deliberately don't declare the `users ↔ items`/`users ↔ collections` reverse/forward relation (nothing in the codebase queries it), which is what keeps `auth` free of a runtime dependency on `items`.

## Enums

- `item_type`: `article` | `tweet` | `image` | `video` | `pdf` | `link`
- `item_status`: `processing` | `ready` | `failed`

Item type is inferred server-side from the URL (see `packages/items/src/domain/detect-item-type.ts`) — the client never sends it directly.

## Migration workflow

Drizzle Kit is configured in `packages/db/drizzle.config.ts`, pointed at `packages/db/schema.ts` (a thin re-export shim over `@second-brain/items/schema` + `@second-brain/auth/schema`) and outputting to `./migrations`.

`packages/db` has no `src/` directory — it's not a feature package, just the migration runner. `migrations/` stays a top-level directory (a sibling of `schema.ts`) since generated SQL files aren't TypeScript source. **Unlike most generated output in this repo (`dist/`, `.next/`), migrations are tracked in git** — they're history, not a build artifact; losing them means losing the ability to reproduce the schema from scratch on a new environment. `.prettierignore` still excludes `packages/db/migrations/` so Prettier doesn't reformat drizzle-kit's own generated `meta/*.json` bookkeeping on every `pnpm format`, but that's a formatting exclusion, not a git one.

```bash
pnpm db:generate   # diff the schema against the last migration, write a new SQL migration file
pnpm db:migrate    # apply all pending migrations to DATABASE_URL
pnpm db:studio     # open Drizzle Studio, a local DB browser/editor
```

These are all `turbo run <task> --filter=@second-brain/db` under the hood (see root `package.json`). Requires `packages/db/.env` to be set — see [Environment Variables](./environment-variables.md).

**Workflow when you change the schema**: edit the owning feature package's `schema/` files (`packages/items/...` or `packages/auth/...`) → `pnpm db:generate` (review the generated SQL in `packages/db/migrations/`) → `pnpm db:migrate` → commit the new migration files alongside the schema change. Never hand-edit generated migration files after they've been applied anywhere — generate a new one instead.

## Querying from apps

Per [Clean Architecture](./clean-architecture.md), `apps/api` and `apps/worker` never import `packages/db`, Drizzle, or schema tables directly — only a feature's own repository does (e.g. `packages/items/src/infrastructure/persistence/drizzle-item-repository.ts`). It implements the `ItemRepository` port interface defined in that same feature's `domain/ports`, and is the only place Drizzle query syntax appears for the items domain:

```ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgClient } from "@second-brain/shared-kernel/db";
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

The repository is also responsible for translating Drizzle's raw row shape into the domain entities `@second-brain/types` declares — e.g. converting `createdAt` from Drizzle's native `Date` to the `string` the `Item` entity expects, and flattening the `itemsToTags`/`itemsToCollections` join-table rows into the `tags`/`collections` arrays `ItemWithRelations` actually declares. `apps/api` and `apps/worker` each instantiate `DrizzleItemRepository` once, in their own `src/composition.ts`, and pass it into use cases from `@second-brain/items`.
