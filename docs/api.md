# API

Fastify server in `apps/api`. Entry point `src/index.ts`.

Base URL locally: `http://localhost:4000` (from `PORT` in `apps/api/.env`).

Today the API serves only `GET /health`. The Item endpoints (save, list, search, retry, delete) come in a later spec. They will be built on the contract wiring described below.

## Contracts: one shared definition of every request and response

Every request and response between `apps/web` and `apps/api` is defined once, as a zod schema in `packages/contracts` (see [ADR 0001](./adr/0001-shared-zod-contracts-package.md)). The package depends only on zod and has one entry point per context:

- `@cue-memory/contracts/common`: shared shapes, such as the error envelope (`errorDtoSchema`).
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

## Auth (placeholder)

There's no real authentication yet. See [Clean Architecture](./clean-architecture.md#the-auth-feature--deliberately-partial) for why `packages/auth` has no application or presentation layer yet. Until better-auth sign-in is wired up, the web app sends a fixed dev user id in an `x-user-id` header.

## `GET /health`

Liveness check.

```
200 OK
{ "status": "ok" }
```
