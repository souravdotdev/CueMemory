# Security

`apps/api` (the only HTTP-facing service besides `apps/web`) registers three plugins, all before any route: [`@fastify/cors`](https://github.com/fastify/fastify-cors), [`@fastify/helmet`](https://github.com/fastify/fastify-helmet), [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit). `apps/worker` has no HTTP surface — it only consumes BullMQ jobs — so no middleware applies there.

## CORS

Previously registered with `{ origin: true }`, which reflects _any_ requesting origin back — effectively CORS disabled. Now `{ origin: env.CORS_ORIGIN }`, a new env var (see [Environment Variables](./environment-variables.md)) pointing at the web app's actual origin, defaulting to `http://localhost:3000` for local dev.

**Important nuance, verified directly rather than assumed**: with a static string `origin`, `@fastify/cors` always sets `Access-Control-Allow-Origin` to that configured value on every response — it does not conditionally omit the header based on what `Origin` the request actually sent. The protection isn't "the server hides the header from bad origins" — it's that the _browser_ refuses to let a page at a different origin read a response whose `Access-Control-Allow-Origin` doesn't match its own origin. The property that actually matters (and what `src/security.test.ts` asserts) is that the header is locked to the one configured origin and never reflects an arbitrary origin back — which is exactly what `origin: true` used to do.

## Helmet

Registered with `{ contentSecurityPolicy: false }`. This sets the standard helmet header set (`X-Content-Type-Options`, `X-Frame-Options`, `X-DNS-Prefetch-Control`, `Strict-Transport-Security`, etc.) on every response, confirmed live via `curl -I` against a running server.

**CSP is deliberately disabled here**, not omitted by oversight: Content-Security-Policy is enforced by the browser against the _document_ that received it — it governs what that HTML page is allowed to load/execute. It has no effect on a bare `fetch()`/XHR JSON response the way this API only ever returns. Sending a CSP header here is inert for the JSON responses `apps/api` serves. If this API ever serves actual HTML (a docs/Swagger UI, a rendered error page), CSP would need to be configured deliberately for those specific routes — not left as a blanket default.

## Rate limiting

`{ max: 100, timeWindow: "1 minute", redis: rateLimitRedis }`, global (applies to every route). The `429` response and `x-ratelimit-*` headers were confirmed both via a real Redis-backed request against a live server and via `src/security.test.ts` (using an in-memory store with `max: 2` for a fast, deterministic test).

**Why a dedicated Redis connection** (`src/rate-limit-redis.ts`), not the existing BullMQ connection from `@cue-memory/shared-kernel/redis`: BullMQ requires `maxRetriesPerRequest: null` so its blocking commands retry forever — necessary for a job queue, but the opposite of what a rate-limit check wants. Reusing that connection directly risks every API request hanging (not just erroring) during a Redis outage, waiting on a rate-limit check that never resolves. `rate-limit-redis.ts` instead does:

```ts
export const rateLimitRedis: Redis = redisConnection.duplicate({
  maxRetriesPerRequest: 1,
  connectTimeout: 500,
});
```

`.duplicate()` shares the same connection config (host, port, credentials) but overrides these two options — giving rate-limit checks fail-fast behavior without touching BullMQ's own connection semantics. Verified live: the API boots cleanly against real Redis, and the `x-ratelimit-remaining` counter correctly decrements across real requests, proving the dedicated connection is actually the one being used.

## `apps/web` response headers

`next.config.ts`'s `headers()` sets, on every route: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Confirmed present on a real `next build` + `next start` response via `curl -I`.

**No CSP here either, for now** — deliberately deferred, not forgotten. Unlike `apps/api`, a CSP on `apps/web` _would_ be meaningful (it serves real HTML), but getting one right for a Next.js app means handling nonces for inline scripts/hydration data correctly, and verifying it doesn't break the dev server, Turbopack, or the production build — real work that deserves its own dedicated pass with actual browser testing, not a policy added blind alongside unrelated middleware.

## Dependency updates (Dependabot)

`.github/dependabot.yml` — GitHub's native bot, two independent jobs:

- **Security updates** run regardless of the schedule below: the moment a dependency in this repo has a CVE published against it (GitHub's own advisory database, not a third-party feed), Dependabot opens a PR bumping just that package to the patched version.
- **Version updates** run weekly (Mondays): checks for newer versions of everything and opens PRs to bump them.

This matters more here than in a typical repo because most dependencies in this monorepo are deliberately **pinned** rather than left on `"latest"` — done repeatedly throughout this project's setup specifically because `"latest"` kept resolving to versions that broke on install (ESLint 10 vs. `typescript-eslint`, TypeScript 7 vs. `typescript-eslint`, jsdom 30 vs. Node 20 — see [Code Quality](./code-quality.md) and [Testing](./testing.md)). Pinning fixes the immediate breakage but means nothing moves forward on its own afterward — Dependabot is what actually keeps pinned versions from just going stale indefinitely.

**Two ecosystems configured**, both at the repo root:

- `npm` — covers every `package.json` in the pnpm workspace through the single root `pnpm-lock.yaml`. One entry at `directory: "/"` is enough; Dependabot discovers the whole workspace from there rather than needing one entry per package. (`"npm"` is just the ecosystem's YAML key — it auto-detects pnpm from the lockfile.)
- `docker` — the `postgres:16-alpine` / `redis:7-alpine` base images referenced in `docker-compose.yml`.

**Noise control**: minor/patch bumps (low-risk, and numerous across 11 workspace packages) are grouped into a single weekly PR via the `minor-and-patch` group. Major version bumps are deliberately left ungrouped — they're the ones actually likely to need a real look before merging, so bundling them together would hide that.

**Not configured**: a `github-actions` ecosystem entry — there's no CI workflow in `.github/workflows/` yet for it to track. Trivial to add once one exists.
