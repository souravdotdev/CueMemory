# Testing

[Vitest](https://vitest.dev) is wired into every app and package that has runtime logic worth testing, following the same "shared base + per-package config" pattern as ESLint and TypeScript.

## Shared config — `packages/vitest-config`

Two presets, mirroring the eslint-config split between plain Node packages and `apps/web`:

- `./node` (`node.mjs`) — plain Node test environment. Used by `packages/items`, `packages/auth`, `packages/db`, `apps/api`, `apps/worker`.
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
- `infrastructure/persistence/tag-mappers.test.ts` — `toTag` and `toTagLink` (the `tags` and `item_tags` rows to the domain `Tag` and `TagLink`, keeping dates as `Date` and dropping the link's denormalized `user_id`), the same way as `toItem`.
- `domain/tag-name.test.ts` — `slugifyTagName`'s normalization rules and 50-character limit, and that `TAG_NAME_PATTERN` (which the `tags` CHECK constraint embeds) accepts exactly the slugs it produces.
- `presentation/queue/process-item.processor.test.ts` — tests `createProcessItemHandler(fakeDependencies)` directly with a hand-built fake BullMQ `Job` (just an object with a `.data` field) — no real queue needed.
- `presentation/http/item-card-mapper.test.ts` — `toItemCardDto` with a hand-written fake `ThumbnailUrlResolver`: the generic failure message for Failed Items, a null Thumbnail URL for a null Thumbnail key, ISO created time, an empty Tag list for an untagged Item, AI and User Tags (given as domain `AppliedTag` `{ tag, source }` pairs) carrying the right source, no internal fields on the card or its tags, and every output parsing with `itemCardDtoSchema`.

**`packages/auth`**:

- `infrastructure/persistence/user-mappers.test.ts` tests `toUser` the same way `packages/items`' mapper tests do: pure row→entity conversion, no database connection.
- `domain/sign-in-decision.test.ts` — `decideSignIn`: an active User → allow, deleted 1 day ago → restore, deleted exactly 30 days ago → restore, deleted 31 days ago (or a millisecond past the Grace period) → refuse.
- `application/use-cases/admit-sign-in.test.ts` — `admitSignIn` with a hand-written fake `UserRepository`: an allowed sign-in refreshes the Display name and avatar, a missing Google name keeps the current one, a restore also clears the deletion time, a refusal throws `UserPermanentlyDeletedError` and changes nothing, a missing Google photo clears the avatar, and the email is never in the changes.
- `infrastructure/better-auth/google-profile.test.ts` — `googleProfileFromIdToken` on hand-built unsigned JWTs: name and picture claims, a missing photo or name → null, and a non-JWT is refused.
- `infrastructure/better-auth/sign-in-hook.test.ts` — the session-create hook with a fake Better Auth context and `UserRepository`: the profile comes from the Google Sign-in identity's ID token, a refusal becomes an `APIError` coded `USER_PERMANENTLY_DELETED` with a "permanently deleted" message, and a User without a Google ID token gets an `APIError` coded `GOOGLE_PROFILE_UNAVAILABLE`.
- `application/use-cases/resolve-signed-in-user.test.ts` — `resolveSignedInUser` with a hand-written fake `SessionResolver`: an active User comes back, and no Session or a deleted User's Session is nobody.
- `presentation/http/me-mapper.test.ts` — `toMeResponseDto`: display name, avatar and ISO created time, a null avatar URL for a User without one, never the deletion time, and the output parses with `meResponseDtoSchema`.
- `infrastructure/better-auth/better-auth-session-resolver.test.ts` — `BetterAuthSessionResolver` over a fake `getSession`: it passes the request's headers through, no Session is null, and Better Auth's User maps to the domain `User` (avatar to `profileImg`, a missing avatar to null, the deletion time carried over).
- `infrastructure/better-auth/create-auth.test.ts` builds the real Better Auth instance over `drizzle.mock({ schema })` (no database) and checks only what answers before a table is touched: a provider other than Google gets a 404, a sign-in or link request that adds its own `scopes` gets a 400, Google's authorization URL asks for exactly `openid email profile`, and the Session cookie has no domain unless a cookie domain is configured. Better Auth disables its origin checks under a test runner, so the trusted-origin setting isn't covered here. The full Google round trip can't be automated; it's checked by hand.
- `presentation/http/auth-routes.test.ts` registers `authRoutes` on a Fastify app with a hand-written fake `AuthRequestHandler`, through `inject`: GET and POST requests reach the handler as web `Request`s with their full URL, headers and raw body (JSON, form-encoded or empty), Better Auth's status, headers, body and every `set-cookie` come back unchanged, and auth routes hit their stricter rate limit while other routes don't.

**`packages/db`** — `src/entry-points.test.ts` checks that the Postgres client (`@cue-memory/db/client`) and the Redis connection (`@cue-memory/db/redis`) each validate only their own variable: either imports with the other's URL unset, and each refuses to load without a valid URL of its own. Like `env.test.ts` in `apps/api`, it stubs `process.env` and re-imports after `vi.resetModules()`; `ioredis` is mocked so no socket is opened (postgres.js doesn't connect until the first query).

**`apps/api`** — no item-specific tests anymore (those moved to `packages/items` with the routes themselves); `src/security.test.ts` still tests the app-level middleware stack directly, including CORS allowing credentials for the configured origin (see [Security](./security.md)). `src/require-user.test.ts` tests the `requireUser` guard and `GET /me` through `inject`, on a Fastify app with the shared contracts registered (`registerContracts`), a hand-written fake `SessionResolver` and a dummy protected route: no Session and a deleted User's Session both get 401 in the `unauthorized` envelope, a valid Session reaches the route with the right User, and `/me` returns the User in the `me` contract (with a null avatar when there's none). `src/env.test.ts` checks that the API refuses to start when an auth variable is missing or invalid: it stubs `process.env` with `vi.stubEnv` and re-imports `env.ts` after `vi.resetModules()`, since the module validates once at import time.

**`apps/worker`** — no test files at all anymore (its only test, the job-processor test, moved to `packages/items` with the processor itself); its `vitest.config.ts` sets `passWithNoTests: true` so the empty suite doesn't fail the task — `composition.ts`/`index.ts` are pure wiring, and the logic they wire together is tested where it now lives.

**`apps/web`** — `save-form.test.tsx` tests the `SaveForm` client component with `@testing-library/react` + `@testing-library/user-event`, mocking `next/navigation`'s `useRouter` and the `@/lib/api` module (so no real `fetch` call or `NEXT_PUBLIC_API_URL` env var is needed). `src/lib/api.test.ts` tests the API helpers themselves against a stubbed global `fetch` (`vi.stubGlobal`): a valid response returns the parsed DTO, a response that breaks the contract throws, and a failure throws the error envelope's `message`.

**`packages/ui`** — `button.test.tsx` — a basic render/click/disabled-state test proving the `jsdom` + React preset works, independent of any app.

**`packages/contracts`** — pure schema tests next to each contract (`common/error.test.ts`, `common/pagination.test.ts`, `auth/me.test.ts`, `items/create-item.test.ts`, `items/create-item-response.test.ts`, `items/item-card.test.ts`, `items/list-items.test.ts`): what each schema accepts, rejects, defaults and strips.

## Fakes over mocking libraries

Every fake used across these tests is either a small hand-written object literal or a `vi.fn()` — no separate mocking framework, and no shared "fakes" package. Given how small each port interface is (1-3 methods), writing the fake inline in the test file that needs it is less overhead than maintaining a shared fixture module, and keeps each test file readable on its own.

## Pre-push gate

`.husky/pre-push` runs `pnpm lint && pnpm check-types && pnpm test` — tests are part of the last gate before code leaves the machine, alongside lint and type-checking (see [Code Quality](./code-quality.md)). They're not part of `pre-commit` (`lint-staged`), since running a full test suite on every commit — including ones that don't touch tested code — would slow down the fast, scoped pre-commit check down considerably.

## A real bug this setup caught while being built

Building the `apps/api` route tests originally surfaced a genuine regression risk: `tsc` (then `apps/api`'s/`apps/worker`'s build tool) compiled `*.test.ts` files into `dist/` alongside real source, and Vitest's default file-discovery glob picked up both the source test and its compiled `dist/` copy — silently double-running every test, and shipping test files in what's meant to be production build output. Originally fixed by excluding `**/*.test.ts`/`**/*.test.tsx` in those apps' `tsconfig.json`. That exclusion was later removed once `apps/api`/`apps/worker` switched their production build to `tsup` (see [Architecture](./architecture.md#monorepo-layout)) — a bundler only pulls in files actually reachable from its entry point, so test files never leak into `dist/` regardless of tsconfig excludes, and removing the exclusion restored `tsc --noEmit`'s type-checking coverage for test files, which it had been silently skipping. The `**/dist/**` exclude in the shared Vitest config stays in place regardless, as a second line of defense.
