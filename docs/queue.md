# Queue & Background Jobs

Async processing is handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## `packages/items/src/infrastructure/queue`

Per [Clean Architecture](./clean-architecture.md), the `ProcessItemJob` payload type and the `ItemQueue` port interface are owned by `packages/items`' own `domain/ports` — the infrastructure here implements that port, it doesn't define the contract:

- `queues.ts` — `QUEUE_NAMES.ITEM_PROCESSING` and the `itemProcessingQueue` BullMQ `Queue` instance (typed against `ProcessItemJob`), built on the shared `redisConnection` from `@cue-memory/shared-kernel/redis`
- `bullmq-item-queue.ts` — `BullMqItemQueue`, the concrete class implementing `ItemQueue`. Its `enqueueProcessing` method is the only place `itemProcessingQueue.add(...)` gets called.

Default job options (`queues.ts`): 3 attempts with exponential backoff (5s base delay), and completed/failed jobs are trimmed (`removeOnComplete: 1000`, `removeOnFail: 5000`) so Redis doesn't accumulate job history indefinitely.

## Producer: `apps/api`

`POST /items` (see [API](./api.md)) calls the `saveItem` use case (`packages/items/src/application/use-cases/save-item.ts`), which inserts the item as `status: "processing"` via the injected `ItemRepository`, then calls `itemQueue.enqueueProcessing(...)` on the injected `ItemQueue` — the route handler itself never touches BullMQ. The concrete `BullMqItemQueue` instance is created once in `apps/api/src/composition.ts` and passed in.

## Consumer: `apps/worker`

`src/index.ts` starts a BullMQ `Worker` listening on `QUEUE_NAMES.ITEM_PROCESSING` with `concurrency: 5`, handled by `createProcessItemHandler(dependencies)` (`packages/items/src/presentation/queue/process-item.processor.ts`) — a thin adapter that unwraps the BullMQ `Job` and calls the `processItem` use case (`packages/items/src/application/use-cases/process-item.ts`):

1. Calls the injected `MetadataFetcher` to fetch metadata for the item's `sourceUrl`
2. Updates the item's `title` and sets `status: "ready"` via the injected `ItemRepository`
3. On any thrown error, sets `status: "failed"` and rethrows (so BullMQ's retry/backoff applies)

**Current state: metadata fetching is stubbed.** `packages/items/src/infrastructure/metadata/stub-metadata-fetcher.ts`'s `StubMetadataFetcher` just uses the URL's hostname as the title — it's the concrete implementation of the `MetadataFetcher` port wired up in `apps/worker/src/composition.ts`. Real extraction (Open Graph for articles, oEmbed for tweets, the YouTube API for videos, text extraction for PDFs) and the AI tag-suggestion call are not implemented yet; see product plan section 6 for the intended scope. When that gets built, only this one adapter file changes — the `processItem` use case, the port interface, and everything else stays untouched.

The worker logs `[worker] processed item <id>` on success and the error message on failure (`worker.on("completed"/"failed", ...)`), and closes gracefully on `SIGTERM`.

## Verifying it works locally

With Postgres + Redis running and both `apps/api` and `apps/worker` started:

```bash
curl -X POST http://localhost:4000/items \
  -H "Content-Type: application/json" \
  -H "x-user-id: <existing user id>" \
  -d '{"url":"https://example.com/some-article"}'
```

Then `GET /items` with the same header — the item's `status` should flip from `processing` to `ready` within a second or two, and the worker's stdout logs the processed item id.
