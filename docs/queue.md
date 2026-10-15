# Queue & Background Jobs

Async processing is handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## Current state: the API produces, the worker doesn't consume yet

`POST /items` (see [API](./api.md#post-items)) stores a Processing Item, then enqueues one **Process Item** job on the **Items queue**. Nothing consumes that queue yet: `apps/worker/src/index.ts` only builds its container, connects to Redis and logs `[worker] connected; waiting for work`. The worker's Processing (detect the Item type, mark the Item Ready or Failed) comes in the next tickets of spec #66.

- **Shared names and payload.** `@cue-memory/shared/schemas/queue` exports `ITEMS_QUEUE` (`"items"`), `PROCESS_ITEM_JOB` (`"process-item"`) and `ProcessItemJobSchema` / `ProcessItemJob`: `{ itemId, userId }`, both UUIDs. Only ids travel through Redis; the worker loads the Item itself, scoped to its User. Both apps use these constants and the schema, never typed-out strings.
- **Producer (`apps/api`).** `SaveItemUseCase` depends only on the `IQueueProvider` port (`domain/providers/IQueueProvider.ts`, `enqueueProcessItem(job)`). `BullMqQueueProvider` (`infrastructure/queue/`) implements it: it parses the payload with `ProcessItemJobSchema`, so a payload the worker would refuse never reaches Redis, then adds the job with the defaults below. The BullMQ `Queue` itself is built once in `infrastructure/queue/itemsQueue.ts` on the shared Redis connection and bound as `TOKENS.ItemsQueue`; only the container imports it. The lint guard keeps `bullmq` out of domain and application code.
- **Job defaults.** 3 attempts with exponential backoff from 5 s (so retries 5 s and 10 s later), `removeOnComplete: 1000` and `removeOnFail: 5000` so Redis doesn't keep job history forever.
- **If enqueueing fails** (Redis down), `POST /items` answers `500 internal`. The Item is already stored and stays Processing; there is no retry endpoint yet.

What else it builds on:

- **The Redis connection.** `@cue-memory/db/redis` exports `redisConnection`, built once with `maxRetriesPerRequest: null` because BullMQ's blocking commands need it. The API's Items queue uses it directly; the rate-limit store uses its own fail-fast duplicate of it (see [Security](./security.md#rate-limiting)).
- **The Items domain and output.** The `Item` and `Tag` entities, the Tag name rule and the Item card output are in `apps/api` (see [Clean Architecture](./clean-architecture.md#the-four-layers)), and the `items`, `tags` and `item_tags` tables are in `packages/db` (see [Database](./database.md)).

## The planned consumer

The worker follows the same layering as the API; [Clean Architecture](./clean-architecture.md#the-worker-documented-not-yet-built) has the full plan. In short:

- **Consumer (`apps/worker`).** `worker.ts` creates the BullMQ `Worker` and switches on `job.name`. A thin processor in `interface/processors/` parses `job.data` with the payload's zod schema and calls one use case from the worker's own container (`WORKER_TOKENS`). The use case fetches metadata through a port, marks the Item `ready`, or marks it `failed` and rethrows, so BullMQ's retry and backoff apply. An unknown job name throws `UnrecoverableError` and is not retried. The processor parses with `ProcessItemJobSchema` from `@cue-memory/shared/schemas/queue`.

Real extraction (Open Graph for articles, oEmbed for tweets, the YouTube API for videos, text extraction for PDFs) and the AI tag-suggestion call are not implemented; see product plan section 6 for the intended scope. Why an Item failed is logged by the worker with the Item id, not stored (see [Database](./database.md#schema)).
