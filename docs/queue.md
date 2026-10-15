# Queue & Background Jobs

Async processing is handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## Current state: the API produces, the worker detects the Item type, title and description

`POST /items` (see [API](./api.md#post-items)) stores a Processing Item, then enqueues one **Process Item** job on the **Items queue**. The worker consumes it: it fetches the Source URL once (guarded), works out the Item type from the URL's shape, then the response, then the page's own declarations, reads the page's title and description, and marks the Item Ready with them; once the job fails with no attempt left (its last retry, or a stall), it marks the Item Failed.

- **Shared names and payload.** `@cue-memory/shared/schemas/queue` exports `ITEMS_QUEUE` (`"items"`), `PROCESS_ITEM_JOB` (`"process-item"`) and `ProcessItemJobSchema` / `ProcessItemJob`: `{ itemId, userId }`, both UUIDs. Only ids travel through Redis; the worker loads the Item itself, scoped to its User. Both apps use these constants and the schema, never typed-out strings.
- **Producer (`apps/api`).** `SaveItemUseCase` depends only on the `IQueueProvider` port (`domain/providers/IQueueProvider.ts`, `enqueueProcessItem({ itemId, userId })`, typed by the port's own `ProcessItemRequest`, since the domain imports nothing outside itself). `BullMqQueueProvider` (`infrastructure/queue/`) implements it: it maps the request to the shared payload and parses it with `ProcessItemJobSchema`, so a payload the worker would refuse never reaches Redis, then adds the job with the defaults below. The BullMQ `Queue` itself is built once in `infrastructure/queue/itemsQueue.ts` on the shared Redis connection and bound as `TOKENS.ItemsQueue`; only the container imports it. The lint guard keeps `bullmq` out of domain and application code.
- **Job defaults.** 3 attempts with exponential backoff from 5 s (so retries 5 s and 10 s later), `removeOnComplete: 1000` and `removeOnFail: 5000` so Redis doesn't keep job history forever.
- **If enqueueing fails** (Redis down), `POST /items` answers `500 internal`. The Item is already stored and stays Processing; there is no retry endpoint yet.
- **Consumer (`apps/worker`).** `index.ts` builds the container, pings Redis and starts `createItemsWorker` (`interface/itemsWorker.ts`): a BullMQ `Worker` on `ITEMS_QUEUE` over the shared Redis connection. Its job switch, `runItemsJob`, dispatches by `job.name`; an unknown name throws `UnrecoverableError`, so it fails without a retry. The Process Item processor (`interface/processors/processItem.processor.ts`) parses `job.data` with `ProcessItemJobSchema`; an invalid payload also throws `UnrecoverableError`. Otherwise it runs `ProcessItemUseCase` from the worker's container and logs the outcome. On SIGINT/SIGTERM the worker finishes its current job (`worker.close()`), then closes Redis.
- **Processing.** `ProcessItemUseCase` loads the Item scoped to its User (a deleted Item is nothing to do: the job completes), applies the URL rules (`domain/rules/itemTypeFromUrl.ts`) and fetches the Source URL once through the `IUrlFetcher` port (`domain/providers/IUrlFetcher.ts`), **every Item, typed or not**, for its title and description. The fetch reports the final URL after redirects, and the Item type is the first signal that answers, in the order in [Detection order](#detection-order) (so a short link such as `bit.ly`, `t.co` or `lnkd.in` to YouTube becomes a Video). The Item becomes Ready with its type, title and description. The Source URL is never changed: it stays as pasted.
- **When the fetch fails.** A refused, failed or timed-out fetch (or a 5xx/429 answer) doesn't need to fail an Item a URL rule already typed: it becomes Ready with that type and no title or description. An Item with no type yet rethrows, so BullMQ retries with the defaults above and, out of attempts, it ends Failed as a Link. Any other error (Postgres down) propagates either way.
- **Failure.** `createItemsWorker` listens for the Worker's `failed` event with `onItemsJobFailed` (`interface/itemsJobFailed.ts`). Every failed attempt is logged with its job, attempt number and reason (`console.error`); the reason is not stored. An attempt BullMQ will retry leaves the Item Processing. Once no attempt is left, BullMQ moves the job to the failed set and sets `job.finishedOn`; that is the handler's signal, whatever the attempt count says. It covers the last retry, an unrecoverable error, and a job that stalled more than the Worker's `maxStalledCount` allows (default 1; BullMQ fails it with `UnrecoverableError: job stalled more than allowable limit` when it's next picked up, attempts left or not). Then the job name's final-failure step runs (`interface/itemsJobs.ts` pairs each name with its processor and that step): for a Process Item job, `processItemFailed` (`interface/processors/processItemFailed.processor.ts`) runs `FailItemUseCase`: the Item becomes Failed, and an Item with no Item type yet becomes a Link, so it still displays like any other Item. An invalid payload names no Item and an unknown name has no step, so neither changes an Item. If marking the Item fails, the handler logs it and the Item stays Processing; there is no retry endpoint yet.

### URL rules

`itemTypeFromUrl(url)` (`domain/rules/itemTypeFromUrl.ts`) is pure and works on any URL, pasted or reached by redirect: it returns an Item type, or null when no rule matches (the response and the page decide). It tries the **known-site table** first, then the **file extension** ending the path. Only the URL's path is matched, never its query or fragment.

**Known sites** (`domain/rules/knownSites.ts`, `KNOWN_SITES`) is plain data: each row is hosts, an optional path pattern and an Item type, so adding a site is one row. Hosts are compared lower-case without a leading `www.` or `m.`; `*.example.com` matches any subdomain and `*` any host. Rows run in order and the first match wins, so a GitHub issue (Post) sits above a GitHub repository (Code). Profiles, homepages and listings on these hosts match no row and are typed by the page like any other.

| Item type | Known sites                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video     | YouTube (`/watch`, `/shorts/`, `/live/`, `youtu.be`), Vimeo, TikTok videos and `vm.`/`vt.` short links, Twitch videos and clips, Dailymotion (`dai.ly`), Loom, Instagram reels, Facebook videos (`fb.watch`)                                                            |
| Audio     | Spotify tracks, albums, playlists, episodes and shows; SoundCloud tracks and sets; Apple Podcasts; Apple Music albums, playlists and songs; Bandcamp tracks and albums                                                                                                  |
| Post      | X/Twitter `/<user>/status/<id>`, Threads, Bluesky, Mastodon `/@<user>/<id>` on any host, LinkedIn posts, Facebook posts, Reddit threads (`redd.it`), Instagram posts (`/p/`), GitHub issues, pull requests and discussions, Stack Overflow and Stack Exchange questions |
| Code      | GitHub, GitLab and Bitbucket repositories, files and folders; Gist; CodePen; CodeSandbox; Replit; npm and PyPI package pages                                                                                                                                            |
| Article   | Medium, Substack, dev.to and Hashnode pieces; LinkedIn articles (`/pulse/`)                                                                                                                                                                                             |
| Image     | Imgur, Flickr photos (`flic.kr`), Unsplash photos                                                                                                                                                                                                                       |

**File extensions** (`domain/rules/itemTypeFromExtension.ts`), any case:

| Path ends                                                                                                                                                                                  | Item type |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `.pdf`                                                                                                                                                                                     | PDF       |
| `.png .jpg .jpeg .gif .webp .svg .avif .heic .bmp .tif .tiff`                                                                                                                              | Image     |
| `.mp3 .wav .m4a .ogg .oga .opus .flac .aac`                                                                                                                                                | Audio     |
| `.mp4 .m4v .mov .webm .mkv .avi`                                                                                                                                                           | Video     |
| archives (`.zip .rar .7z .tar .gz .tgz .bz2 .xz`), documents (`.doc(x) .xls(x) .ppt(x) .odt .ods .odp .rtf .epub`), installers and disk images (`.dmg .pkg .exe .msi .apk .deb .rpm .iso`) | File      |
| anything else                                                                                                                                                                              | no rule   |

### Detection order

`itemTypeOf` in `ProcessItemUseCase.ts` is the one place the order is written down; the first signal that answers wins:

1. the URL rules on the Source URL as pasted, then on the final URL ([URL rules](#url-rules));
2. a non-HTML response's Content-Type, then its magic bytes ([Response rules](#response-rules));
3. the page's JSON-LD, then its Open Graph tags, then its Twitter Card ([Page rules](#page-rules));
4. Link (anything else, including a 4xx answer).

oEmbed (a known provider endpoint or the page's discovery link) will slot in at the head of step 3 and of the title order (#78); the head parser already extracts discovery links.

### Response rules

`SafeUrlFetcher` (`infrastructure/http/`) implements `IUrlFetcher`: one GET, guarded against server-side request forgery (see [Security](./security.md#the-workers-url-fetch)). It returns the final URL, the Content-Type, the parsed head of an HTML response and the first 16 bytes of any other response. `itemTypeFromResponse` (`domain/rules/itemTypeFromResponse.ts`, pure) types a response by what it is as a file, first match wins, else null:

| Response                                                                                           | Item type |
| -------------------------------------------------------------------------------------------------- | --------- |
| a Content-Type `itemTypeFromContentType` knows (below)                                             | its type  |
| no Content-Type, or `application/octet-stream`: magic bytes `itemTypeFromMagicBytes` knows (below) | its type  |
| anything else (HTML is left to its head)                                                           | none      |

`itemTypeFromContentType` (`domain/rules/itemTypeFromContentType.ts`): `application/pdf` (an arXiv paper without `.pdf`) → PDF; `image/*` → Image; `audio/*`, `application/ogg` → Audio; `video/*` → Video; archives (zip, gzip, tar, 7z, rar …), office documents (Word, Excel, PowerPoint, OpenXML, OpenDocument, RTF), EPUB, disk images and installers (dmg, iso, exe/msi, deb, rpm, apk) → File.

`itemTypeFromMagicBytes` (`domain/rules/itemTypeFromMagicBytes.ts`), for a server that is vague about what it sends: `%PDF-` → PDF; PNG, JPEG, GIF, WebP, TIFF, and ISO media files branded `avif`/`heic` → Image; ID3 or an MPEG frame (MP3), OGG, WAV, FLAC, and ISO media files branded `M4A` → Audio; other ISO media files (MP4, MOV), WebM/MKV, AVI → Video; ZIP (and so docx/xlsx/jar), gzip, 7z, RAR → File.

A 5xx or 429 answer fails the fetch instead (see Processing above). Of an HTML body at most ~1 MB is read, only up to `</head>`; of any other body only the first 16 bytes.

### Page rules

The fetcher parses an HTML head once, in infrastructure (`parsePageHead.ts`, htmlparser2), into a `PageHead` (`domain/entities/PageHead.ts`): its meta tags (keyed by `property`, else `name`, lower-case), its first `<title>`, each JSON-LD block that parses as JSON, and its oEmbed discovery links (absolute). Entities are decoded there. The domain rules read only these tags:

| Rule                                       | Declares                                                                                  | Item type |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | --------- |
| `itemTypeFromJsonLd` (`@type`)             | Article, NewsArticle, BlogPosting                                                         | Article   |
|                                            | VideoObject                                                                               | Video     |
|                                            | AudioObject, PodcastEpisode, MusicRecording                                               | Audio     |
|                                            | SoftwareSourceCode                                                                        | Code      |
|                                            | SocialMediaPosting, DiscussionForumPosting                                                | Post      |
|                                            | ImageObject, only when the page declares nothing else (a featured image doesn't make one) | Image     |
| `itemTypeFromOpenGraph`                    | `og:type` article                                                                         | Article   |
|                                            | `og:type` `video.*`, or (when `og:type` says nothing above) an `og:video` tag             | Video     |
|                                            | `og:type` `music.*`                                                                       | Audio     |
| `itemTypeFromTwitterCard` (`twitter:card`) | `player`                                                                                  | Video     |
|                                            | `photo`                                                                                   | Image     |

JSON-LD nodes are read at the top level, in arrays and in `@graph`, in document order (the first recognised type wins), never inside properties; `schema:Article` and `https://schema.org/Article` count as `Article`.

**Title and description** (`domain/rules/pageMetadata.ts`), each field on its own, from the first source with a non-blank value: Open Graph (`og:title`, `og:description`), then Twitter Card (`twitter:title`, `twitter:description`), then the page (`<title>`, `<meta name="description">`). Whitespace is collapsed; the title is capped at 300 characters and the description at 1000 (cut with an ellipsis). A response that isn't HTML, a 4xx answer and a failed fetch give neither. They are written to the Item's `title` and `description` columns as it becomes Ready.

What else it builds on:

- **The Redis connection.** `@cue-memory/db/redis` exports `redisConnection`, built once with `maxRetriesPerRequest: null` because BullMQ's blocking commands need it. The API's Items queue uses it directly; the rate-limit store uses its own fail-fast duplicate of it (see [Security](./security.md#rate-limiting)).
- **The Items domain and output.** The `Item` and `Tag` entities, the Tag name rule and the Item card output are in `apps/api` (see [Clean Architecture](./clean-architecture.md#the-four-layers)), and the `items`, `tags` and `item_tags` tables are in `packages/db` (see [Database](./database.md)).

## Not yet built

The worker follows the same layering as the API (see [Clean Architecture](./clean-architecture.md#the-worker)). oEmbed (#78), thumbnails, text extraction (PDFs, article bodies) and the AI tag-suggestion call are not implemented; see product plan section 6 for the intended scope. Why an Item failed is logged by the worker with the Item id, not stored (see [Database](./database.md#schema)).
