# Queue & Background Jobs

Async processing is handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## Current state: the API produces, the worker detects the Item type

`POST /items` (see [API](./api.md#post-items)) stores a Processing Item, then enqueues one **Process Item** job on the **Items queue**. The worker consumes it: it works out the Item type from the Source URL's shape, or from one guarded fetch of the page when no rule recognises it, and marks the Item Ready with it; once the job fails with no attempt left (its last retry, or a stall), it marks the Item Failed.

- **Shared names and payload.** `@cue-memory/shared/schemas/queue` exports `ITEMS_QUEUE` (`"items"`), `PROCESS_ITEM_JOB` (`"process-item"`) and `ProcessItemJobSchema` / `ProcessItemJob`: `{ itemId, userId }`, both UUIDs. Only ids travel through Redis; the worker loads the Item itself, scoped to its User. Both apps use these constants and the schema, never typed-out strings.
- **Producer (`apps/api`).** `SaveItemUseCase` depends only on the `IQueueProvider` port (`domain/providers/IQueueProvider.ts`, `enqueueProcessItem({ itemId, userId })`, typed by the port's own `ProcessItemRequest`, since the domain imports nothing outside itself). `BullMqQueueProvider` (`infrastructure/queue/`) implements it: it maps the request to the shared payload and parses it with `ProcessItemJobSchema`, so a payload the worker would refuse never reaches Redis, then adds the job with the defaults below. The BullMQ `Queue` itself is built once in `infrastructure/queue/itemsQueue.ts` on the shared Redis connection and bound as `TOKENS.ItemsQueue`; only the container imports it. The lint guard keeps `bullmq` out of domain and application code.
- **Job defaults.** 3 attempts with exponential backoff from 5 s (so retries 5 s and 10 s later), `removeOnComplete: 1000` and `removeOnFail: 5000` so Redis doesn't keep job history forever.
- **If enqueueing fails** (Redis down), `POST /items` answers `500 internal`. The Item is already stored and stays Processing; there is no retry endpoint yet.
- **Consumer (`apps/worker`).** `index.ts` builds the container, pings Redis and starts `createItemsWorker` (`interface/itemsWorker.ts`): a BullMQ `Worker` on `ITEMS_QUEUE` over the shared Redis connection. Its job switch, `runItemsJob`, dispatches by `job.name`; an unknown name throws `UnrecoverableError`, so it fails without a retry. The Process Item processor (`interface/processors/processItem.processor.ts`) parses `job.data` with `ProcessItemJobSchema`; an invalid payload also throws `UnrecoverableError`. Otherwise it runs `ProcessItemUseCase` from the worker's container and logs the outcome. On SIGINT/SIGTERM the worker finishes its current job (`worker.close()`), then closes Redis.
- **Processing.** `ProcessItemUseCase` loads the Item scoped to its User (a deleted Item is nothing to do: the job completes), applies the URL rules (`domain/rules/itemTypeFromUrl.ts`) and marks the Item Ready with the type. A URL no rule matches is fetched once through the `IUrlFetcher` port (`domain/providers/IUrlFetcher.ts`), and the response decides (see [Response rules](#response-rules)). Any error (a refused, failed or timed-out fetch, Postgres down) propagates, so BullMQ retries with the defaults above.
- **Failure.** `createItemsWorker` listens for the Worker's `failed` event with `onItemsJobFailed` (`interface/itemsJobFailed.ts`). Every failed attempt is logged with its job, attempt number and reason (`console.error`); the reason is not stored. An attempt BullMQ will retry leaves the Item Processing. Once no attempt is left, BullMQ moves the job to the failed set and sets `job.finishedOn`; that is the handler's signal, whatever the attempt count says. It covers the last retry, an unrecoverable error, and a job that stalled more than the Worker's `maxStalledCount` allows (default 1; BullMQ fails it with `UnrecoverableError: job stalled more than allowable limit` when it's next picked up, attempts left or not). Then the job name's final-failure step runs (`interface/itemsJobs.ts` pairs each name with its processor and that step): for a Process Item job, `processItemFailed` (`interface/processors/processItemFailed.processor.ts`) runs `FailItemUseCase`: the Item becomes Failed, and an Item with no Item type yet becomes a Link, so it still displays like any other Item. An invalid payload names no Item and an unknown name has no step, so neither changes an Item. If marking the Item fails, the handler logs it and the Item stays Processing; there is no retry endpoint yet.

### URL rules

`itemTypeFromUrl(url)` (`domain/rules/itemTypeFromUrl.ts`) is pure and works on any URL, pasted or reached by redirect: it returns an Item type, or null when no rule matches (the use case then fetches the page). It tries the **known-site table** first, then the **file extension** ending the path. Only the URL's path is matched, never its query or fragment.

**Known sites** (`domain/rules/knownSites.ts`, `KNOWN_SITES`) is plain data: each row is hosts, an optional path pattern and an Item type, so adding a site is one row. Hosts are compared lower-case without a leading `www.` or `m.`; `*.example.com` matches any subdomain and `*` any host. Rows run in order and the first match wins, so a GitHub issue (Post) sits above a GitHub repository (Code). Profiles, homepages and listings on these hosts match no row and are fetched like any other page.

| Item type | Known sites                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video     | YouTube (`/watch`, `/shorts/`, `/live/`, `youtu.be`), Vimeo, TikTok videos and `vm.`/`vt.` short links, Twitch videos and clips, Dailymotion (`dai.ly`), Loom, Instagram reels, Facebook videos (`fb.watch`)                                                            |
| Audio     | Spotify tracks, albums, playlists, episodes and shows; SoundCloud tracks and sets; Apple Podcasts; Apple Music albums, playlists and songs; Bandcamp tracks and albums                                                                                                  |
| Post      | X/Twitter `/<user>/status/<id>`, Threads, Bluesky, Mastodon `/@<user>/<id>` on any host, LinkedIn posts, Facebook posts, Reddit threads (`redd.it`), Instagram posts (`/p/`), GitHub issues, pull requests and discussions, Stack Overflow and Stack Exchange questions |
| Code      | GitHub, GitLab and Bitbucket repositories, files and folders; Gist; CodePen; CodeSandbox; Replit; npm and PyPI package pages                                                                                                                                            |
| Article   | Medium, Substack, dev.to and Hashnode pieces; LinkedIn articles (`/pulse/`)                                                                                                                                                                                             |
| Image     | Imgur, Flickr photos (`flic.kr`), Unsplash photos                                                                                                                                                                                                                       |

**File extensions** (`domain/rules/itemTypeFromExtension.ts`), any case:

| Path ends                                                                                                                                                                                  | Item type       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `.pdf`                                                                                                                                                                                     | PDF             |
| `.png .jpg .jpeg .gif .webp .svg .avif .heic .bmp .tif .tiff`                                                                                                                              | Image           |
| `.mp3 .wav .m4a .ogg .oga .opus .flac .aac`                                                                                                                                                | Audio           |
| `.mp4 .m4v .mov .webm .mkv .avi`                                                                                                                                                           | Video           |
| archives (`.zip .rar .7z .tar .gz .tgz .bz2 .xz`), documents (`.doc(x) .xls(x) .ppt(x) .odt .ods .odp .rtf .epub`), installers and disk images (`.dmg .pkg .exe .msi .apk .deb .rpm .iso`) | File            |
| anything else                                                                                                                                                                              | no rule (fetch) |

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

The worker follows the same layering as the API (see [Clean Architecture](./clean-architecture.md#the-worker)). Real extraction (Open Graph for articles, oEmbed for posts, the YouTube API for videos, text extraction for PDFs) and the AI tag-suggestion call are not implemented; see product plan section 6 for the intended scope. Why an Item failed is logged by the worker with the Item id, not stored (see [Database](./database.md#schema)).
