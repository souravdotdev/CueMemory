# Security

`apps/api` (the only HTTP-facing service besides `apps/web`) registers three plugins in `buildApp` (`src/app.ts`), all before any route: [`@fastify/cors`](https://github.com/fastify/fastify-cors), [`@fastify/helmet`](https://github.com/fastify/fastify-helmet), [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit). Errors are sent through one error middleware (`src/interface/middleware/error.middleware.ts`) that never puts a domain message, stack trace or internal detail in a response (see [API](./api.md#error-envelope)). `apps/worker` has no HTTP surface (it only consumes queue jobs), so no middleware applies there; it does make one outbound request per unrecognised Source URL, which is guarded (see [The worker's URL fetch](#the-workers-url-fetch)).

## CORS

Previously registered with `{ origin: true }`, which reflects _any_ requesting origin back — effectively CORS disabled. Now `{ origin: env.WEB_ORIGIN, credentials: true }`: `WEB_ORIGIN` (see [Environment Variables](./environment-variables.md)) is the web app's actual origin, required and never a wildcard, and `credentials: true` lets the browser send and accept the Session cookie on its cross-origin calls to the API ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md)). The same origin is Better Auth's only trusted origin, so a sign-in can only send the browser back to the web app.

**Important nuance, verified directly rather than assumed**: with a static string `origin`, `@fastify/cors` always sets `Access-Control-Allow-Origin` to that configured value on every response — it does not conditionally omit the header based on what `Origin` the request actually sent. The protection isn't "the server hides the header from bad origins" — it's that the _browser_ refuses to let a page at a different origin read a response whose `Access-Control-Allow-Origin` doesn't match its own origin. The property that actually matters (and what `tests/unit/app.test.ts` asserts) is that the header is locked to the one configured origin and never reflects an arbitrary origin back — which is exactly what `origin: true` used to do.

## Helmet

Registered with `{ contentSecurityPolicy: false }`. This sets the standard helmet header set (`X-Content-Type-Options`, `X-Frame-Options`, `X-DNS-Prefetch-Control`, `Strict-Transport-Security`, etc.) on every response, confirmed live via `curl -I` against a running server.

**CSP is deliberately disabled here**, not omitted by oversight: Content-Security-Policy is enforced by the browser against the _document_ that received it — it governs what that HTML page is allowed to load/execute. It has no effect on a bare `fetch()`/XHR JSON response the way this API only ever returns. Sending a CSP header here is inert for the JSON responses `apps/api` serves. If this API ever serves actual HTML (a docs/Swagger UI, a rendered error page), CSP would need to be configured deliberately for those specific routes — not left as a blanket default.

## Rate limiting

`{ max: 100, timeWindow: "1 minute", redis: rateLimitRedis }`, global (applies to every route). The auth routes under `/api/auth/*` get a stricter per-route limit instead, 30 a minute, set by `authRoutes` (`src/interface/routes/auth.routes.ts`) through the route's `config.rateLimit` (tested in `tests/unit/interface/routes/auth.routes.test.ts`). Better Auth's own built-in rate limiter (in-memory, production only) stays at its defaults behind it. The `429` response and `x-ratelimit-*` headers were confirmed both via a real Redis-backed request against a live server and via `tests/unit/app.test.ts` and `auth.routes.test.ts` (with the test container binding `IN_MEMORY_RATE_LIMITS`, so the limits count in an in-memory store). The production container binds the Redis store under `TOKENS.RateLimitRedis`; `buildApp` reads it as required, so a container that forgets it fails to build rather than silently limiting per process.

**Why a dedicated Redis connection** (`src/rate-limit-redis.ts`), not the shared BullMQ-ready connection from `@cue-memory/db/redis`: BullMQ requires `maxRetriesPerRequest: null` so its blocking commands retry forever — necessary for a job queue, but the opposite of what a rate-limit check wants. Reusing that connection directly risks every API request hanging (not just erroring) during a Redis outage, waiting on a rate-limit check that never resolves. `rate-limit-redis.ts` instead does:

```ts
export const rateLimitRedis: Redis = redisConnection.duplicate({
  maxRetriesPerRequest: 1,
  connectTimeout: 500,
});
```

`.duplicate()` shares the same connection config (host, port, credentials) but overrides these two options — giving rate-limit checks fail-fast behavior without touching BullMQ's own connection semantics. Verified live: the API boots cleanly against real Redis, and the `x-ratelimit-remaining` counter correctly decrements across real requests, proving the dedicated connection is actually the one being used.

## The worker's URL fetch

A Source URL is whatever a User pasted, and when no URL rule recognises it the worker fetches it once to classify it (see [Queue](./queue.md#response-rules)). Unguarded, that is server-side request forgery: a User could point the worker at `http://169.254.169.254/` (cloud metadata and credentials), `http://localhost:6379`, or anything else on the private network. `SafeUrlFetcher` (`apps/worker/src/infrastructure/http/SafeUrlFetcher.ts`) is the only way the worker fetches, and it:

- **Refuses non-public addresses**, checking every address the host resolves to (one bad answer refuses the URL): loopback, private, carrier-grade NAT, link-local (incl. `169.254.169.254`), unspecified, multicast, documentation and reserved IPv4; and IPv6 loopback, unspecified, unique-local (`fc00::/7`, incl. `fd00:ec2::254`), link-local, site-local, multicast, and the ranges that embed an IPv4 address (IPv4-mapped `::ffff:0:0/96` judged by the IPv4 inside, IPv4-compatible, NAT64, 6to4, Teredo). The list is `publicAddress.ts`, built on Node's `net.BlockList`. IP-literal hosts in any spelling (`2130706433`, `0x7f.1`, `[::ffff:7f00:1]`) are normalised by the WHATWG URL parser first and checked the same way.
- **Pins the connection to the checked addresses.** The request's `lookup` answers only with the addresses just checked, so the socket can't connect anywhere else; a DNS answer that changes between the check and the connect (DNS rebinding) never reaches the socket. `agent: false` keeps it from reusing a pooled socket. TLS still verifies the certificate against the hostname.
- **Follows redirects by hand**, at most 5, resolving and checking each hop like the first; a redirect to a non-HTTP(S) scheme is refused.
- **Bounds the work**: one 10-second timeout covers the whole fetch (every hop and the body), an HTML body is read at most ~1 MB and only up to `</head>`, any other body only for its first 16 bytes, and `Accept-Encoding: identity` means nothing is decompressed. It sends `User-Agent: CueMemory/1.0 (…)`.
- **Fails the attempt** on a refusal, a network error, a timeout or a 5xx/429 answer: the error propagates, so the job retries and, once no attempt is left, the Item is Failed. No response body ever reaches the User or the logs beyond the classified Item type.

Not covered: there's no outbound proxy or egress firewall behind this; the guard is in-process. Tests: `tests/unit/infrastructure/http/` (see [Testing](./testing.md)).

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

**Noise control**: minor/patch bumps (low-risk, and numerous across every workspace package) are grouped into a single weekly PR via the `minor-and-patch` group. Major version bumps are deliberately left ungrouped — they're the ones actually likely to need a real look before merging, so bundling them together would hide that.

**Not configured**: a `github-actions` ecosystem entry — there's no CI workflow in `.github/workflows/` yet for it to track. Trivial to add once one exists.
