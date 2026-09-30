# API contracts live in one shared zod package, separate from domain entities

Every request and response between `apps/web` and `apps/api` is defined once, as a zod schema in `packages/contracts` (subpaths per context: `common`, `items`, later `auth`). The API validates and serializes through those schemas with `fastify-type-provider-zod`, and the web client parses every response with them, so a contract change breaks the compile or fails loudly at the boundary instead of drifting. DTOs are deliberately not the domain entities: entities hold `Date`s and every field the domain needs, while each feature's presentation layer maps an entity to a view-shaped DTO (`ItemCardDto`) that exposes only what that view needs, with ISO timestamps, signed thumbnail URLs and friendly failure messages. There's no API versioning: web and api ship together from one monorepo, so the contract only has to agree with itself at each deploy.

## Considered Options

- **Share the domain entities with the web app**: no mapping code, but every field added to an entity leaks onto the wire (internal ids, extracted text, storage keys), and the domain gets shaped by JSON.
- **DTO schemas in each feature's presentation layer** (the previous design): the web app would have to import feature packages that pull in Drizzle and Postgres, or keep a second hand-written copy of every shape, which is how `ItemWithRelations` drifted.
- **Repurpose `@cue-memory/types`**: workable, but the name hides that it's now a runtime contract, not just types.

## Consequences

- Item type and status value lists exist in both the domain and the contract. A compile-time assertion in the presentation mapper catches drift.
- Adding a field to an API response is always an explicit edit in two places: the contract schema and the presentation mapper.
- If a client ever ships separately (a mobile app, a public API), this decision needs revisiting to add versioning.
