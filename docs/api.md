# API

Fastify server in `apps/api`. Entry point `src/index.ts`.

Base URL locally: `http://localhost:4000` (from `PORT` in `apps/api/.env`).

Today the API serves `GET /health`, Better Auth's routes under `/api/auth/*`, and `GET /me`. The Item endpoints (save, list, search, retry, delete) come in a later spec. They will be built on the contract wiring described below.

## Contracts: one shared definition of every request and response

Every request and response between `apps/web` and `apps/api` is defined once, as a zod schema in `packages/contracts` (see [ADR 0001](./adr/0001-shared-zod-contracts-package.md)). The package depends only on zod and has one entry point per context:

- `@cue-memory/contracts/common`: shared shapes, such as the error envelope (`errorDtoSchema`).
- `@cue-memory/contracts/auth`: the signed-in User (`meResponseDtoSchema`).
- `@cue-memory/contracts/items`: Item shapes, such as the create-Item request (`createItemRequestDtoSchema`).

Naming: TypeScript types end in `Dto` and zod schemas in `DtoSchema` (for example `CreateItemRequestDto` / `createItemRequestDtoSchema`). A plain `Item` is always the domain entity, never a wire shape.

The same schema is used on both sides. For example, the web save form validates a pasted link with `createItemRequestDtoSchema` before it calls the API, and the API validates the request body with that schema too. So the form and the server never disagree. That schema trims the link, requires a valid `http` or `https` URL, and allows at most 2048 characters.

### How the API uses contracts

`registerContracts(app)` (`apps/api/src/contracts.ts`) is called once in `src/index.ts`, before plugins and routes are registered. It:

- Registers the [`fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod) validator and serializer compilers, and returns the app typed with `ZodTypeProvider`.
- Installs the global error handler and not-found handler, so every error uses the envelope below.

A route declares its contracts in `schema`, and Fastify then:

- **Validates the request** (`body`, `querystring`, `params`) before the handler runs. `request.body` and the others are typed from the schema.
- **Serializes the response** through the schema declared for that status code. This acts as an output filter: any field that the handler returns but the contract doesn't declare is stripped. So adding a field to an entity never leaks it onto the wire.

```ts
app.post(
  "/items",
  {
    schema: {
      body: createItemRequestDtoSchema,
      response: { 201: itemCardDtoSchema },
    },
  },
  async (request, reply) => {
    // request.body is CreateItemRequestDto, already trimmed and validated
  },
);
```

## Error envelope

Every API error is sent in one envelope (`errorDtoSchema` in `@cue-memory/contracts/common`), so the web app can handle errors in one place:

```json
{ "error": { "code": "validation_failed", "message": "The request is invalid", "details": [] } }
```

`details` is optional. When present it is a list of `{ path, message }` issues, one per field that failed validation. The `code` is always one of:

| Code                | Status | When                                                                                                                                                                                                                                                          |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation_failed` | 400    | The request doesn't match its contract. `details` lists each issue as `{ "path": "/url", "message": "Enter a valid http(s) link" }`. Other client errors (malformed JSON, an unsupported content type, ...) also use this code, with a fixed generic message. |
| `unauthorized`      | 401    | The request isn't authenticated.                                                                                                                                                                                                                              |
| `not_found`         | 404    | The route or resource doesn't exist.                                                                                                                                                                                                                          |
| `rate_limited`      | 429    | The client went over the rate limit (100 requests a minute, see [Security](./security.md)).                                                                                                                                                                   |
| `internal`          | 500    | Anything unexpected. The message is always generic: the real error is logged on the server and never sent to the client, so no stack traces, SQL or internal hostnames leak.                                                                                  |

Example validation failure:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request is invalid",
    "details": [{ "path": "/url", "message": "Enter a valid http(s) link" }]
  }
}
```

## Auth

Three pieces, all from `@cue-memory/auth`: Better Auth's own routes under `/api/auth/*` (signing in and out), the `requireUser` guard every protected route runs, and `GET /me`, the first protected route.

### Better Auth: `/api/auth/*`

[Better Auth](https://better-auth.com) runs inside the API and serves every route under `/api/auth/*` (GET and POST), mounted by `authRoutes` from `@cue-memory/auth` before any other route ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md), [Clean Architecture](./clean-architecture.md#the-auth-feature-layer-by-layer)). These routes answer in Better Auth's own shapes, not the contracts' error envelope. The ones that matter today:

- `POST /api/auth/sign-in/social` with `{ "provider": "google", "callbackURL": "<web origin>/..." }` starts a Google sign-in and returns the Google URL to send the browser to. Any other provider gets `404 PROVIDER_NOT_FOUND`, a `scopes` field asking Google for more gets a 400, and a `callbackURL` outside the web origin is refused.
- `GET /api/auth/callback/google` is where Google sends the browser back. It creates the User, their Sign-in identity and a Session, sets the Session cookie, and redirects to the `callbackURL`.
- `GET /api/auth/get-session` and `POST /api/auth/sign-out` read and end the current Session.
- `GET /api/auth/ok` is a liveness check: `{ "ok": true }`.

They're rate-limited more strictly than the rest of the API (see [Security](./security.md#rate-limiting)).

### The `requireUser` guard

Every protected route declares `preHandler: requireUser({ sessions })` and reads the caller with `signedInUser(request)`. No route parses identity headers itself. The guard asks the `SessionResolver` port for the User of the request's Session cookie (in production `BetterAuthSessionResolver`, which checks the `sessions` table on every request), then:

- no valid Session (missing, expired, revoked or forged cookie) → `401 unauthorized`;
- a Session whose User has a deletion time → `401 unauthorized`, so a deleted User's old Sessions stop working;
- otherwise the domain User is attached to the request and the route runs.

The 401 goes through the shared error handler, so it's the standard envelope:

```json
{ "error": { "code": "unauthorized", "message": "You need to sign in to do that" } }
```

The web app still sends a fixed dev user id in an `x-user-id` header until its sign-in lands; no API route reads it.

### `GET /me`

The signed-in User, in `meResponseDtoSchema` (`@cue-memory/contracts/auth`). Protected by `requireUser`.

```
200 OK
{
  "id": "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  "displayName": "Sourav Sanjay",
  "email": "sourav@example.com",
  "avatarUrl": "https://lh3.googleusercontent.com/a/...",
  "createdAt": "2026-04-01T00:00:00.000Z"
}
```

`avatarUrl` is null when the User has no Google photo. Without a valid Session it's `401 unauthorized`.

## `GET /health`

Liveness check.

```
200 OK
{ "status": "ok" }
```
