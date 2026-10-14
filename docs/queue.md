# Queue & Background Jobs

Async processing will be handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## Current state: no queue

There is no queue today. The first Item-processing pipeline was torn down pending the schema redesign, and `apps/worker/src/index.ts` only logs `[worker] nothing to consume yet`. `apps/api` enqueues nothing.

What already exists for it:

- **The Redis connection.** `@cue-memory/db/redis` exports `redisConnection`, built once with `maxRetriesPerRequest: null` because BullMQ's blocking commands need it. Today only `apps/api`'s rate-limit store uses Redis, through its own fail-fast duplicate of this connection (see [Security](./security.md#rate-limiting)).
- **The Items domain and output.** The `Item` and `Tag` entities, the Tag name rule and the Item card output are in `apps/api` (see [Clean Architecture](./clean-architecture.md#the-four-layers)), and the `items`, `tags` and `item_tags` tables are in `packages/db` (see [Database](./database.md)).

## The planned shape

When the first queue lands it follows the same layering as the API; [Clean Architecture](./clean-architecture.md#the-worker-documented-not-yet-built) has the full plan. In short:

- **Producer (`apps/api`).** A save use case stores the Item as `processing` through a repository port, then enqueues through an `IQueueProvider` port in `domain/providers/`. A BullMQ adapter in `infrastructure/` implements that port. The use case and route never import `bullmq`.
- **Consumer (`apps/worker`).** `worker.ts` creates the BullMQ `Worker` and switches on `job.name`. A thin processor in `interface/processors/` parses `job.data` with the payload's zod schema and calls one use case from the worker's own container (`WORKER_TOKENS`). The use case fetches metadata through a port, marks the Item `ready`, or marks it `failed` and rethrows, so BullMQ's retry and backoff apply. An unknown job name throws `UnrecoverableError` and is not retried.
- **Shared names and payloads.** Queue names and payload schemas go in `@cue-memory/shared` under a queue entry point, added with the first queue.

The first pipeline used 3 attempts with exponential backoff (5s base delay) and trimmed finished jobs (`removeOnComplete: 1000`, `removeOnFail: 5000`) so Redis doesn't keep job history forever; the rebuild should start from the same defaults. Real extraction (Open Graph for articles, oEmbed for tweets, the YouTube API for videos, text extraction for PDFs) and the AI tag-suggestion call are not implemented; see product plan section 6 for the intended scope. Why an Item failed is logged by the worker with the Item id, not stored (see [Database](./database.md#schema)).
