# Queue & Background Jobs

Async processing is handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## Current state: the API produces, the worker detects the Item type

`POST /items` (see [API](./api.md#post-items)) stores a Processing Item, then enqueues one **Process Item** job on the **Items queue**. The worker consumes it: it works out the Item type from the Source URL's shape, or from one guarded fetch of the page when no rule recognises it, and marks the Item Ready with it; if its last attempt fails, it marks the Item Failed.

- **Shared names and payload.** `@cue-memory/shared/schemas/queue` exports `ITEMS_QUEUE` (`"items"`), `PROCESS_ITEM_JOB` (`"process-item"`) and `ProcessItemJobSchema` / `ProcessItemJob`: `{ itemId, userId }`, both UUIDs. Only ids travel through Redis; the worker loads the Item itself, scoped to its User. Both apps use these constants and the schema, never typed-out strings.
- **Producer (`apps/api`).** `SaveItemUseCase` depends only on the `IQueueProvider` port (`domain/providers/IQueueProvider.ts`, `enqueueProcessItem(job)`). `BullMqQueueProvider` (`infrastructure/queue/`) implements it: it parses the payload with `ProcessItemJobSchema`, so a payload the worker would refuse never reaches Redis, then adds the job with the defaults below. The BullMQ `Queue` itself is built once in `infrastructure/queue/itemsQueue.ts` on the shared Redis connection and bound as `TOKENS.ItemsQueue`; only the container imports it. The lint guard keeps `bullmq` out of domain and application code.
- **Job defaults.** 3 attempts with exponential backoff from 5 s (so retries 5 s and 10 s later), `removeOnComplete: 1000` and `removeOnFail: 5000` so Redis doesn't keep job history forever.
- **If enqueueing fails** (Redis down), `POST /items` answers `500 internal`. The Item is already stored and stays Processing; there is no retry endpoint yet.
- **Consumer (`apps/worker`).** `index.ts` builds the container, pings Redis and starts `createItemsWorker` (`interface/itemsWorker.ts`): a BullMQ `Worker` on `ITEMS_QUEUE` over the shared Redis connection. Its job switch, `runItemsJob`, dispatches by `job.name`; an unknown name throws `UnrecoverableError`, so it fails without a retry. The Process Item processor (`interface/processors/processItem.processor.ts`) parses `job.data` with `ProcessItemJobSchema`; an invalid payload also throws `UnrecoverableError`. Otherwise it runs `ProcessItemUseCase` from the worker's container and logs the outcome. On SIGINT/SIGTERM the worker finishes its current job (`worker.close()`), then closes Redis.
- **Processing.** `ProcessItemUseCase` loads the Item scoped to its User (a deleted Item is nothing to do: the job completes), applies the URL rules (`domain/rules/itemTypeFromUrl.ts`) and marks the Item Ready with the type. A URL no rule matches is fetched once through the `IUrlFetcher` port (`domain/providers/IUrlFetcher.ts`), and the response decides (see [Response rules](#response-rules)). Any error (a refused, failed or timed-out fetch, Postgres down) propagates, so BullMQ retries with the defaults above.
- **Failure.** `createItemsWorker` listens for the Worker's `failed` event with `onItemsJobFailed` (`interface/itemsJobFailed.ts`). Every failed attempt is logged with its job, attempt number and reason (`console.error`); the reason is not stored. An earlier attempt leaves the Item Processing, since BullMQ retries it. After the final attempt (`job.attemptsMade >= job.opts.attempts`), `processItemFailed` (`interface/processors/processItemFailed.processor.ts`) runs `FailItemUseCase`: the Item becomes Failed, and an Item with no Item type yet becomes a Link, so it still displays like any other Item. An unrecoverable job (invalid payload, unknown name) changes no Item. If marking the Item fails, the handler logs it and the Item stays Processing; there is no retry endpoint yet.

### URL rules

`itemTypeFromUrl` is pure: it returns an Item type, or null when no rule matches (the use case then fetches the page). Rules run in order and the first match wins. Hosts are compared lower-case without a leading `www.` or `m.`; only the URL's path is matched, never its query or fragment.

| URL                                                          | Item type       |
| ------------------------------------------------------------ | --------------- |
| `x.com` / `twitter.com` with `/<user>/status/<id>`           | Tweet           |
| `youtube.com/watch`, `/shorts/…`, `/live/…`; `youtu.be/<id>` | Video           |
| `instagram.com/reel/…` or `/reels/…`                         | Video           |
| `instagram.com/p/…`                                          | Image           |
| `reddit.com/r/<sub>/comments/…`; `redd.it/<id>`              | Article         |
| path ends `.pdf` (any case)                                  | PDF             |
| path ends `.png .jpg .jpeg .gif .webp .svg .avif` (any case) | Image           |
| anything else                                                | no rule (fetch) |

### Response rules

`SafeUrlFetcher` (`infrastructure/http/`) implements `IUrlFetcher`: one GET, guarded against server-side request forgery (see [Security](./security.md#the-workers-url-fetch)). `itemTypeFromResponse` (`domain/rules/itemTypeFromResponse.ts`, pure) types what it returns:

| Response                                                              | Item type |
| --------------------------------------------------------------------- | --------- |
| `Content-Type: application/pdf` (an arXiv paper without `.pdf`)       | PDF       |
| `Content-Type: image/*`                                               | Image     |
| HTML whose `<head>` has `<meta property="og:type" content="article">` | Article   |
| anything else, including a 4xx answer                                 | Link      |

A 5xx or 429 answer fails the attempt instead, so the job retries. Only an HTML body is read, at most ~1 MB and only up to `</head>`.

What else it builds on:

- **The Redis connection.** `@cue-memory/db/redis` exports `redisConnection`, built once with `maxRetriesPerRequest: null` because BullMQ's blocking commands need it. The API's Items queue uses it directly; the rate-limit store uses its own fail-fast duplicate of it (see [Security](./security.md#rate-limiting)).
- **The Items domain and output.** The `Item` and `Tag` entities, the Tag name rule and the Item card output are in `apps/api` (see [Clean Architecture](./clean-architecture.md#the-four-layers)), and the `items`, `tags` and `item_tags` tables are in `packages/db` (see [Database](./database.md)).

## Not yet built

The worker follows the same layering as the API (see [Clean Architecture](./clean-architecture.md#the-worker)). Real extraction (Open Graph for articles, oEmbed for tweets, the YouTube API for videos, text extraction for PDFs) and the AI tag-suggestion call are not implemented; see product plan section 6 for the intended scope. Why an Item failed is logged by the worker with the Item id, not stored (see [Database](./database.md#schema)).
