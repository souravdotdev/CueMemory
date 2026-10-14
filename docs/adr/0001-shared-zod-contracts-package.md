# API contracts live in one shared zod package, separate from domain entities

Every request and response between `apps/web` and `apps/api` is defined once, as a zod schema in `packages/shared` (`@cue-memory/shared/schemas/{common,items,auth}`). Each schema is named `XSchema` and exported alongside its inferred type, named for the shape without the suffix (`MeResponseSchema` and `MeResponse`, `CreateItemSchema` and `CreateItemInput`, `ItemCardSchema` and `ItemCard`, `ErrorResponseSchema` and `ErrorResponse`). The API validates and serializes through those schemas with `fastify-type-provider-zod`, and the web client parses every response with them, so a contract change breaks the compile or fails loudly at the boundary instead of drifting. The wire shapes are deliberately not the domain entities: entities hold `Date`s and every field the domain needs, while each use case returns an output DTO (`ItemCardOutput`) that exposes only what its view needs, with ISO timestamps, signed thumbnail URLs and friendly failure messages, and the controller sends it through the shared schema. There's no API versioning: web and api ship together from one monorepo, so the contract only has to agree with itself at each deploy.

## Amendment (layer-first restructure, ADR 0004)

This decision originally placed the schemas in `packages/contracts`, named `*Dto`, with the entity-to-DTO mapping in each feature package's presentation layer. With the move to layer-first apps (ADR 0004), the package becomes `packages/shared` and the schemas take the team guide's `XSchema` plus inferred-type naming. The mapping moves to the use case's output DTO in `application/dto/`. The decision itself, one shared zod contract kept separate from the domain entities, is unchanged.

## Considered Options

- **Share the domain entities with the web app**: no mapping code, but every field added to an entity leaks onto the wire (internal ids, extracted text, storage keys), and the domain gets shaped by JSON.
- **DTO schemas in each feature's presentation layer** (the design before this ADR): the web app would have to import feature packages that pull in Drizzle and Postgres, or keep a second hand-written copy of every shape, which is how `ItemWithRelations` drifted.
- **Repurpose `@cue-memory/types`**: workable, but the name hides that it's now a runtime contract, not just types.
- **Keep the name `packages/contracts`** (at the amendment): accurate, but every other project following the team guide calls this package `shared` with `schemas/` subpaths, and matching it lets code and reviewers move between projects.

## Consequences

- Item type and status value lists exist in both the domain and the shared schemas. A compile-time assertion where the output DTO is built catches drift.
- Adding a field to an API response is always an explicit edit in two places: the shared schema and the output DTO mapping.
- The shared package holds wire schemas only. Queue payload schemas get a `queue/` subpath only when the worker has a queue.
- If a client ever ships separately (a mobile app, a public API), this decision needs revisiting to add versioning.
