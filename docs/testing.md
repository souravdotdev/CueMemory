# Testing

[Vitest](https://vitest.dev) is wired into every app and package that has runtime logic worth testing, following the same "shared base + per-package config" pattern as ESLint and TypeScript.

## Shared config — `packages/vitest-config`

Two presets, mirroring the eslint-config split between plain Node packages and `apps/web`:

- `./node` (`node.mjs`) — plain Node test environment. Used by `packages/items`, `packages/auth`, `packages/shared-kernel`, `apps/api`, `apps/worker`.
- `./react` (`react.mjs`) — `jsdom` environment + `@vitejs/plugin-react`, built on top of `./node` via `mergeConfig`. Used by `packages/ui`, `apps/web`.

Every package with tests has its own two-line `vitest.config.ts` importing one of these, and a `test` script (`vitest run`).

```bash
pnpm test   # vitest run in every package, via Turborepo
```

**Why the shared config files are `.mjs`, not `.ts`** (unlike every other shared config in this repo, which is `.ts`/`.js` extended via a package.json `exports` field): Vite's own config-file loader treats anything resolved through `node_modules` — which is how a pnpm workspace package resolves — as external and leaves it unbundled. A workspace package's raw `.ts` file can't be `import`ed directly by Node (no type-stripping applied), so a `vitest.config.ts` in one package importing a `.ts` file from `@cue-memory/vitest-config` fails with `ERR_UNKNOWN_FILE_EXTENSION`. Plain `.mjs` sidesteps this since Node can load it natively, no transform needed. Each _consuming_ package's own `vitest.config.ts` stays `.ts` — that file is the true entry point Vite bundles directly, so it doesn't hit the same issue.

**jsdom is pinned to `^29.1.1`, not the current `30.x`**: jsdom 30 requires Node `^22.22.2` or newer; this project targets Node `≥20`. jsdom 29 supports `^20.19.0`. If the project's Node baseline moves to 22+, this pin should move too.

## What's actually tested, and why

**`packages/items`** — the flagship test suite, and the direct payoff of the Clean Architecture refactor (see [Clean Architecture](./clean-architecture.md)): use cases take a `deps` object typed against plain interfaces, so tests pass hand-written fakes (usually `vi.fn()`-based) instead of a real database or Redis.

- `domain/detect-item-type.test.ts` — every URL-classification branch
- `application/use-cases/save-item.test.ts` — creates with the right record shape, enqueues the right job, propagates a repository failure without enqueueing
- `application/use-cases/list-items.test.ts` — delegates to the repository with the right arguments
- `application/use-cases/process-item.test.ts` — success path (status → ready with title) and failure path (status → failed, error rethrown)
- `infrastructure/persistence/item-mappers.test.ts` — `toItem` (the Drizzle-row-to-domain-`Item` conversion, keeping dates as `Date`) in isolation, with no database connection. It was deliberately extracted into its own `item-mappers.ts` file specifically so it could be imported without pulling in the Drizzle client (which opens a real Postgres connection and validates `DATABASE_URL` at module load — see [Environment Variables](./environment-variables.md)). `DrizzleItemRepository` itself isn't unit-tested; its actual query logic needs a real or containerized Postgres, which isn't set up yet.
- `presentation/queue/process-item.processor.test.ts` — tests `createProcessItemHandler(fakeDependencies)` directly with a hand-built fake BullMQ `Job` (just an object with a `.data` field) — no real queue needed.
- `presentation/http/item-card-mapper.test.ts` — `toItemCardDto` with a hand-written fake `ThumbnailUrlResolver`: the generic failure message for Failed Items, a null Thumbnail URL for a null Thumbnail key, ISO created time, no internal fields, and every output parsing with `itemCardDtoSchema`.

**`packages/auth`** — `user-mappers.test.ts` tests `toUser` the same way `packages/items`' mapper tests do: pure row→entity conversion, no database connection.

**`packages/shared-kernel`** — wired (config + `test` script), but has no test file yet. `pgClient`/`redisConnection` are one-line wrappers around a live connection that need real infra at import time — there's no pure logic to extract the way there was in `packages/items`' mappers. Its `vitest.config.ts` sets `passWithNoTests: true` so the empty suite doesn't fail the task.

**`apps/api`** — no item-specific tests anymore (those moved to `packages/items` with the routes themselves); `src/security.test.ts` still tests the app-level middleware stack directly (see below).

**`apps/worker`** — no test files at all anymore (its only test, the job-processor test, moved to `packages/items` with the processor itself); its `vitest.config.ts` sets `passWithNoTests: true` for the same reason `packages/shared-kernel`'s does — `composition.ts`/`index.ts` are pure wiring, and the logic they wire together is tested where it now lives.

**`apps/web`** — `save-form.test.tsx` tests the `SaveForm` client component with `@testing-library/react` + `@testing-library/user-event`, mocking `next/navigation`'s `useRouter` and the `@/lib/api` module (so no real `fetch` call or `NEXT_PUBLIC_API_URL` env var is needed). `src/lib/api.test.ts` tests the API helpers themselves against a stubbed global `fetch` (`vi.stubGlobal`): a valid response returns the parsed DTO, a response that breaks the contract throws, and a failure throws the error envelope's `message`.

**`packages/ui`** — `button.test.tsx` — a basic render/click/disabled-state test proving the `jsdom` + React preset works, independent of any app.

**`packages/contracts`** — pure schema tests next to each contract (`common/error.test.ts`, `common/pagination.test.ts`, `items/create-item.test.ts`, `items/create-item-response.test.ts`, `items/item-card.test.ts`, `items/list-items.test.ts`): what each schema accepts, rejects, defaults and strips.

## Fakes over mocking libraries

Every fake used across these tests is either a small hand-written object literal or a `vi.fn()` — no separate mocking framework, and no shared "fakes" package. Given how small each port interface is (1-3 methods), writing the fake inline in the test file that needs it is less overhead than maintaining a shared fixture module, and keeps each test file readable on its own.

## Pre-push gate

`.husky/pre-push` runs `pnpm lint && pnpm check-types && pnpm test` — tests are part of the last gate before code leaves the machine, alongside lint and type-checking (see [Code Quality](./code-quality.md)). They're not part of `pre-commit` (`lint-staged`), since running a full test suite on every commit — including ones that don't touch tested code — would slow down the fast, scoped pre-commit check down considerably.

## A real bug this setup caught while being built

Building the `apps/api` route tests originally surfaced a genuine regression risk: `tsc` (then `apps/api`'s/`apps/worker`'s build tool) compiled `*.test.ts` files into `dist/` alongside real source, and Vitest's default file-discovery glob picked up both the source test and its compiled `dist/` copy — silently double-running every test, and shipping test files in what's meant to be production build output. Originally fixed by excluding `**/*.test.ts`/`**/*.test.tsx` in those apps' `tsconfig.json`. That exclusion was later removed once `apps/api`/`apps/worker` switched their production build to `tsup` (see [Architecture](./architecture.md#monorepo-layout)) — a bundler only pulls in files actually reachable from its entry point, so test files never leak into `dist/` regardless of tsconfig excludes, and removing the exclusion restored `tsc --noEmit`'s type-checking coverage for test files, which it had been silently skipping. The `**/dist/**` exclude in the shared Vitest config stays in place regardless, as a second line of defense.
