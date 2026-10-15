# API

Fastify server in `apps/api`, organised by layer (see [Clean Architecture](./clean-architecture.md)). Entry point `src/index.ts`, which builds the DI container (`src/di/container.ts`) and passes it to `buildApp` (`src/app.ts`).

Base URL locally: `http://localhost:4000` (from `PORT` in `apps/api/.env`).

Today the API serves `GET /health`, Better Auth's routes under `/api/auth/*`, `GET /me` and `POST /items` (save a URL). The other Item endpoints (list, search, retry, delete) come in later specs, built on the same schema wiring described below.

## Shared schemas: one definition of every request and response

Every request and response between `apps/web` and `apps/api` is defined once, as a zod schema in `packages/shared` (see [ADR 0001](./adr/0001-shared-zod-contracts-package.md)). The package depends only on zod and has one entry point per context:

- `@cue-memory/shared/schemas/common`: shared shapes, such as the error envelope (`ErrorResponseSchema`).
- `@cue-memory/shared/schemas/auth`: the signed-in User (`MeResponseSchema`).
- `@cue-memory/shared/schemas/items`: Item shapes, such as the create-Item input (`CreateItemSchema`) and the Item card (`ItemCardSchema`).
- `@cue-memory/shared/schemas/queue`: not HTTP, but the API ↔ worker contract: the Items queue name, the Process Item job name and its payload (see [Queue](./queue.md)).

Naming: zod schemas end in `Schema` and their inferred TypeScript types drop the suffix (for example `CreateItemSchema` / `CreateItemInput`, `ItemCardSchema` / `ItemCard`). A plain `Item` is always the domain entity in `apps/api/src/domain/entities`, never a wire shape.

The same schema is used on both sides. For example, the web save form validates a pasted link with `CreateItemSchema` before it calls the API, and `POST /items` validates the request body with that schema too. So the form and the server never disagree. That schema trims the link, requires a valid `http` or `https` URL, and allows at most 2048 characters.

### How the API uses the schemas

`buildApp` (`apps/api/src/app.ts`), before any plugin or route is registered:

- Sets the [`fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod) validator and serializer compilers, and types the app with `ZodTypeProvider`.
- Calls `registerErrorMiddleware(app)` (`src/interface/middleware/error.middleware.ts`), which installs the global error handler and not-found handler, so every error uses the envelope below.

A route file in `src/interface/routes/` declares its schemas in `schema`, and Fastify then:

- **Validates the request** (`body`, `querystring`, `params`) before the handler runs. `request.body` and the others are typed from the schema.
- **Serializes the response** through the schema declared for that status code. This acts as an output filter: any field that the handler returns but the schema doesn't declare is stripped. So adding a field to an entity never leaks it onto the wire.

The handler itself only calls a controller (`src/interface/controllers/`), which the container builds and which calls a use case:

```ts
app.post(
  "/items",
  {
    preHandler: authMiddleware(container),
    schema: {
      body: CreateItemSchema,
      response: { 201: CreateItemResponseSchema },
    },
  },
  // request.body is CreateItemInput, already trimmed and validated
  (request, reply) => itemsController().create(request, reply),
);
```

## Error envelope

Every API error is sent in one envelope (`ErrorResponseSchema` in `@cue-memory/shared/schemas/common`), so the web app can handle errors in one place:

```json
{ "error": { "code": "validation_failed", "message": "The request is invalid", "details": [] } }
```

`details` is optional. When present it is a list of `{ path, message }` issues, one per field that failed validation. The `code` is always one of:

| Code                | Status | When                                                                                                                                                                                                                                                        |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation_failed` | 400    | The request doesn't match its schema. `details` lists each issue as `{ "path": "/url", "message": "Enter a valid http(s) link" }`. Other client errors (malformed JSON, an unsupported content type, ...) also use this code, with a fixed generic message. |
| `unauthorized`      | 401    | The request isn't authenticated.                                                                                                                                                                                                                            |
| `not_found`         | 404    | The route or resource doesn't exist.                                                                                                                                                                                                                        |
| `rate_limited`      | 429    | The client went over the rate limit (100 requests a minute, see [Security](./security.md)).                                                                                                                                                                 |
| `internal`          | 500    | Anything unexpected. The message is always generic: the real error is logged on the server and never sent to the client, so no stack traces, SQL or internal hostnames leak.                                                                                |

Use cases throw domain errors from `apps/api/src/domain/errors` (`AppError` and its subclasses), never HTTP errors. The error middleware maps each error's code to a status: `NOT_FOUND` → 404, `UNAUTHORIZED` and `USER_PERMANENTLY_DELETED` → 401, `REPOSITORY_ERROR` → 500. Each status is then sent with the fixed, safe message for its envelope code, so a domain error's own message never reaches the client.

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

Three pieces, all in `apps/api`: Better Auth's own routes under `/api/auth/*` (signing in and out), the auth middleware every protected route runs, and `GET /me`, the first protected route.

### Better Auth: `/api/auth/*`

[Better Auth](https://better-auth.com) runs inside the API (`src/infrastructure/auth/createAuth.ts`) and serves every route under `/api/auth/*` (GET and POST), mounted by `authRoutes` (`src/interface/routes/auth.routes.ts`) before any other route ([ADR 0003](./adr/0003-auth-lives-on-the-api-with-subdomain-cookies.md), [Clean Architecture](./clean-architecture.md#the-four-layers)). These routes answer in Better Auth's own shapes, not the shared error envelope. The ones that matter today:

- `POST /api/auth/sign-in/social` with `{ "provider": "google", "callbackURL": "<web origin>/..." }` starts a Google sign-in and returns the Google URL to send the browser to. Any other provider gets `404 PROVIDER_NOT_FOUND`, a `scopes` field asking Google for more gets a 400, and a `callbackURL` outside the web origin is refused.
- `GET /api/auth/callback/google` is where Google sends the browser back. On the first sign-in it creates the User and their Sign-in identity. Then, before creating the Session, its session-create hook (`src/infrastructure/auth/signInHook.ts`) runs `AdmitSignInUseCase`, which applies the sign-in rules (Auth ADR 0001):
  - an active User signs in, and their Display name and avatar are refreshed from Google (a missing Google name keeps the current one; the email captured at sign-up never changes);
  - a User deleted within the 30-day Grace period is restored (the deletion time is cleared), and signs in;
  - a User deleted longer ago is refused: no Session is created, and the browser is sent to the error URL (the sign-in's `errorCallbackURL`, or Better Auth's `/api/auth/error`) with `?error=USER_PERMANENTLY_DELETED&error_description=This account was permanently deleted…`.

  On success it sets the Session cookie and redirects to the `callbackURL`.

- `GET /api/auth/get-session` and `POST /api/auth/sign-out` read and end the current Session.
- `GET /api/auth/ok` is a liveness check: `{ "ok": true }`.

They're rate-limited more strictly than the rest of the API (see [Security](./security.md#rate-limiting)).

### The auth middleware

Every protected route declares `preHandler: authMiddleware(container)` (`src/interface/middleware/auth.middleware.ts`) and its controller reads the caller with `signedInUser(request)`. No route parses identity headers itself. The middleware runs `ResolveSignedInUserUseCase`, which asks the `ISessionProvider` port for the User of the request's Session cookie (in production `BetterAuthSessionProvider`, which checks the `sessions` table on every request), then:

- no valid Session (missing, expired, revoked or forged cookie) → `401 unauthorized`;
- a Session whose User has a deletion time → `401 unauthorized`, so a deleted User's old Sessions stop working;
- otherwise the domain User is attached to the request and the route runs.

The use case throws `UnauthorizedError`, which the error middleware sends as 401 in the standard envelope:

```json
{ "error": { "code": "unauthorized", "message": "You need to sign in to do that" } }
```

The web app's requests (`apps/web/src/lib/api.ts`) send the Session cookie with `credentials: "include"`; no identity header is sent or read.

### `GET /me`

The signed-in User, in `MeResponseSchema` (`@cue-memory/shared/schemas/auth`). Protected by the auth middleware. Served by `meRoutes` → `MeController` → `GetMeUseCase`, which turns the domain User into `MeOutput`.

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

## Items

### `POST /items`

Saves a pasted URL as an Item for the signed-in User and answers straight away with its Item card, still Processing and with no Item type. Protected by the auth middleware. Served by `itemsRoutes` → `ItemsController` → `SaveItemUseCase`, which:

1. stores the Item through the `IItemRepository` port (`DrizzleItemRepository`): status `processing`, type null, the Source URL exactly as pasted after trimming. Source URLs aren't unique, so saving the same one twice creates two Items;
2. enqueues its Processing through the `IQueueProvider` port (`BullMqQueueProvider`): a Process Item job with `{ itemId, userId }` on the Items queue (see [Queue](./queue.md));
3. returns the Item card (`CreateItemResponseSchema`, the same shape as `ItemCardSchema`).

```
POST /items
{ "url": "https://youtu.be/dQw4w9WgXcQ" }

201 Created
{
  "id": "3b241101-e2bb-4255-8caf-4136c566a962",
  "sourceUrl": "https://youtu.be/dQw4w9WgXcQ",
  "type": null,
  "status": "processing",
  "title": null,
  "description": null,
  "thumbnailUrl": null,
  "failureMessage": null,
  "createdAt": "2026-04-01T00:00:00.000Z",
  "tags": []
}
```

- No valid Session → `401 unauthorized`. The User always comes from the Session, never from the body.
- A missing URL, one that isn't `http`/`https`, or one over 2048 characters → `400 validation_failed` with the issue at `/url`.
- If the job can't be enqueued (Redis is down), the request fails with `500 internal`. The Item is already stored and stays Processing; there is no retry endpoint yet.

## `GET /health`

Liveness check.

```
200 OK
{ "status": "ok" }
```
