# Queue & Background Jobs

Async processing is handled with [BullMQ](https://docs.bullmq.io) backed by Redis. The reasoning: link fetching, metadata extraction, and AI tagging are all slow/unreliable enough that they can't block the save request (see product plan, section 10) — a user pastes a link, the item appears immediately as `processing`, and a worker fills in the rest.

## Current state: the API produces, the worker detects the Item type, title and description, and keeps Thumbnails for Images and pages

`POST /items` (see [API](./api.md#post-items)) stores a Processing Item, then enqueues one **Process Item** job on the **Items queue**. The worker consumes it: it fetches the Source URL once (guarded), works out the Item type from the URL's shape, then the response, then oEmbed and the page's own declarations, reads the page's title and description, keeps a Thumbnail from an Image Item's image or the picture a page advertises (see [Thumbnails](#thumbnails)), and marks the Item Ready with them; once the job fails with no attempt left (its last retry, or a stall), it marks the Item Failed.

- **Shared names and payload.** `@cue-memory/shared/schemas/queue` exports `ITEMS_QUEUE` (`"items"`), `PROCESS_ITEM_JOB` (`"process-item"`) and `ProcessItemJobSchema` / `ProcessItemJob`: `{ itemId, userId }`, both UUIDs. Only ids travel through Redis; the worker loads the Item itself, scoped to its User. Both apps use these constants and the schema, never typed-out strings.
- **Producer (`apps/api`).** `SaveItemUseCase` depends only on the `IQueueProvider` port (`domain/providers/IQueueProvider.ts`, `enqueueProcessItem({ itemId, userId })`, typed by the port's own `ProcessItemRequest`, since the domain imports nothing outside itself). `BullMqQueueProvider` (`infrastructure/queue/`) implements it: it maps the request to the shared payload and parses it with `ProcessItemJobSchema`, so a payload the worker would refuse never reaches Redis, then adds the job with the defaults below. The BullMQ `Queue` itself is built once in `infrastructure/queue/itemsQueue.ts` on the shared Redis connection and bound as `TOKENS.ItemsQueue`; only the container imports it. The lint guard keeps `bullmq` out of domain and application code.
- **Job defaults.** 3 attempts with exponential backoff from 5 s (so retries 5 s and 10 s later), `removeOnComplete: 1000` and `removeOnFail: 5000` so Redis doesn't keep job history forever.
- **If enqueueing fails** (Redis down), `POST /items` answers `500 internal`. The Item is already stored and stays Processing; there is no retry endpoint yet.
- **Consumer (`apps/worker`).** `index.ts` builds the container, pings Redis and starts `createItemsWorker` (`interface/itemsWorker.ts`): a BullMQ `Worker` on `ITEMS_QUEUE` over the shared Redis connection. Its job switch, `runItemsJob`, dispatches by `job.name`; an unknown name throws `UnrecoverableError`, so it fails without a retry. The Process Item processor (`interface/processors/processItem.processor.ts`) parses `job.data` with `ProcessItemJobSchema`; an invalid payload also throws `UnrecoverableError`. Otherwise it runs `ProcessItemUseCase` from the worker's container and logs the outcome. On SIGINT/SIGTERM the worker finishes its current job (`worker.close()`), then closes Redis.
- **Processing.** `ProcessItemUseCase` loads the Item scoped to its User (a deleted Item is nothing to do: the job completes), applies the URL rules (`domain/rules/itemTypeFromUrl.ts`) and fetches the Source URL once through the `IUrlFetcher` port (`domain/providers/IUrlFetcher.ts`), **every Item, typed or not**, for its title and description. The fetch reports the final URL after redirects, and the Item type is the first signal that answers, in the order in [Detection order](#detection-order) (so a short link such as `bit.ly`, `t.co` or `lnkd.in` to YouTube becomes a Video). The Item becomes Ready with its type, title, description and Thumbnail key, in one update. The Source URL is never changed: it stays as pasted.
- **When the fetch fails.** A refused, failed or timed-out fetch (or a 5xx/429 answer) doesn't need to fail an Item a URL rule already typed: it becomes Ready with that type, titled by its known oEmbed provider when its Source URL has one (an X post behind a login wall still gets its title; see [oEmbed](#oembed)), else with no title or description. An Item with no type yet rethrows, so BullMQ retries with the defaults above and, out of attempts, it ends Failed as a Link. Any other error (Postgres down) propagates either way.
- **Failure.** `createItemsWorker` listens for the Worker's `failed` event with `onItemsJobFailed` (`interface/itemsJobFailed.ts`). Every failed attempt is logged with its job, attempt number and reason (`console.error`); the reason is not stored. An attempt BullMQ will retry leaves the Item Processing. Once no attempt is left, BullMQ moves the job to the failed set and sets `job.finishedOn`; that is the handler's signal, whatever the attempt count says. It covers the last retry, an unrecoverable error, and a job that stalled more than the Worker's `maxStalledCount` allows (default 1; BullMQ fails it with `UnrecoverableError: job stalled more than allowable limit` when it's next picked up, attempts left or not). Then the job name's final-failure step runs (`interface/itemsJobs.ts` pairs each name with its processor and that step): for a Process Item job, `processItemFailed` (`interface/processors/processItemFailed.processor.ts`) runs `FailItemUseCase`: the Item becomes Failed, and an Item with no Item type yet becomes a Link, so it still displays like any other Item. An invalid payload names no Item and an unknown name has no step, so neither changes an Item. If marking the Item fails, the handler logs it and the Item stays Processing; there is no retry endpoint yet.

### URL rules

`itemTypeFromUrl(url)` (`domain/rules/itemTypeFromUrl.ts`) is pure and works on any URL, pasted or reached by redirect: it returns an Item type, or null when no rule matches (the response and the page decide). It tries the **known-site table** first, then the **file extension** ending the path. Only the URL's path is matched, never its query or fragment.

**Known sites** (`domain/rules/knownSites.ts`, `KNOWN_SITES`) is plain data: each row is hosts, an optional path pattern, an Item type and, for a site with one, its oEmbed endpoint (see [oEmbed](#oembed)), so adding a site is one row. Hosts are compared lower-case without a leading `www.` or `m.`; `*.example.com` matches any subdomain and `*` any host that no other row names. Rows run in order and the first match wins (`knownSiteFor`), so a GitHub issue (Post) sits above a GitHub repository (Code). The any-host Mastodon row sits last and never applies to a named host, so `replit.com/@user/123` stays Code and `youtube.com/@channel/123` matches nothing. Profiles, homepages and listings on these hosts match no row and are typed by the page like any other.

| Item type | Known sites                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video     | YouTube (`/watch`, `/shorts/`, `/live/`, `youtu.be`), Vimeo, TikTok videos and `vm.`/`vt.` short links, Twitch videos and clips, Dailymotion (`dai.ly`), Loom, Instagram reels, Facebook videos (`fb.watch`)                                                            |
| Audio     | Spotify tracks, albums, playlists, episodes and shows; SoundCloud tracks and sets; Apple Podcasts; Apple Music albums, playlists and songs; Bandcamp tracks and albums                                                                                                  |
| Post      | X/Twitter `/<user>/status/<id>`, Threads, Bluesky, Mastodon `/@<user>/<id>` on any host, LinkedIn posts, Facebook posts, Reddit threads (`redd.it`), Instagram posts (`/p/`), GitHub issues, pull requests and discussions, Stack Overflow and Stack Exchange questions |
| Code      | GitHub, GitLab and Bitbucket repositories, files and folders; Gist; CodePen; CodeSandbox; Replit; npm and PyPI package pages                                                                                                                                            |
| Article   | Medium, Substack, dev.to and Hashnode pieces; LinkedIn articles (`/pulse/`); arXiv abstract pages (`/abs/`)                                                                                                                                                             |
| PDF       | arXiv papers (`/pdf/`, with or without `.pdf`)                                                                                                                                                                                                                          |
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
2. a file's (a 2xx non-HTML response's) Content-Type, then its magic bytes ([Response rules](#response-rules));
3. oEmbed ([oEmbed](#oembed)), then the page's JSON-LD, then its Open Graph tags, then its Twitter Card ([Page rules](#page-rules));
4. Link (anything else).

**A 4xx answer** (other than 429) on an Item no URL rule typed is not a failure: the fetch resolves as an unsuccessful answer that says nothing about the page, so the Item becomes Ready as a **Link, with no retry** (a missing or forbidden page won't answer differently a few seconds later). Only a 5xx, a 429, a timeout or a refusal fails the fetch and so retries an untyped Item (see Processing above).

Why this order, and why Item types are content forms rather than sites: [Items ADR 0001](./contexts/items/adr/0001-item-types-are-content-forms-detected-in-a-fixed-order.md).

### Response rules

`SafeUrlFetcher` (`infrastructure/http/`) implements `IUrlFetcher`: one GET, guarded against server-side request forgery (see [Security](./security.md#the-workers-url-fetch)). It returns a `FetchedPage` tagged by `kind`, each with the final URL: `html` (the Content-Type and the parsed head), `file` (the Content-Type and the first 16 bytes) or `unsuccessful` (the status of a 4xx answer, nothing read). A 2xx body sent **without a Content-Type** is HTML when its first bytes start like it (`looksLikeHtml`: `<!doctype html`, `<html` or `<head`, any case, after an optional BOM and whitespace; up to 512 bytes are read to decide), so its head is read and its page rules and oEmbed discovery run; otherwise it is a file. `itemTypeFromResponse` (`domain/rules/itemTypeFromResponse.ts`, pure) types a file, first match wins, else null:

| Response                                                                                           | Item type |
| -------------------------------------------------------------------------------------------------- | --------- |
| a Content-Type `itemTypeFromContentType` knows (below)                                             | its type  |
| no Content-Type, or `application/octet-stream`: magic bytes `itemTypeFromMagicBytes` knows (below) | its type  |
| anything else                                                                                      | none      |

`itemTypeFromContentType` (`domain/rules/itemTypeFromContentType.ts`): `application/pdf` (an arXiv paper without `.pdf`) → PDF; `image/*` → Image; `audio/*`, `application/ogg` → Audio; `video/*` → Video; archives (zip, gzip, tar, 7z, rar …), office documents (Word, Excel, PowerPoint, OpenXML, OpenDocument, RTF), EPUB, disk images and installers (dmg, iso, exe/msi, deb, rpm, apk) → File.

`itemTypeFromMagicBytes` (`domain/rules/itemTypeFromMagicBytes.ts`), for a server that is vague about what it sends: `%PDF-` → PDF; PNG, JPEG, GIF, WebP, TIFF, and ISO media files branded `avif`/`heic` → Image; ID3 or an MPEG frame (MP3), OGG, WAV, FLAC, and ISO media files branded `M4A` → Audio; other ISO media files (MP4, MOV), WebM/MKV, AVI → Video; ZIP (and so docx/xlsx/jar), gzip, 7z, RAR → File.

A 5xx or 429 answer fails the fetch instead (see Processing above). Of an HTML body at most ~1 MB is read, only up to `</head>`; of any other body only the first 16 bytes.

### oEmbed

oEmbed gives a clean type and title in one small JSON call, even for pages behind a login wall (an X post, a Reddit thread). For an HTML page, or a page that answered 4xx, Processing asks **at most one** oEmbed endpoint, through the `IOEmbedProvider` port (`domain/providers/IOEmbedProvider.ts`). `oEmbedRequestFor` (`domain/rules/oEmbed.ts`, pure) picks it:

1. a **known provider's endpoint**, chosen from the final URL: the matching known-site row's `oEmbed` endpoint (`knownOEmbedRequestFor`; the provider's hosts and paths are that row's, never a copy): YouTube (one endpoint for `youtube.com` and `youtu.be`), Vimeo, X (`publish.twitter.com`), Spotify, SoundCloud, Reddit and TikTok, asked with `?url=<final URL>&format=json`;
2. otherwise the page's first **discovery link** of JSON format (`<link rel="alternate" type="application/json+oembed">`), used as written. It's an untrusted URL like any Source URL, so the guard checks it the same way.

When the **page fetch itself fails** (a timeout, a 5xx or 429, a refusal) for an Item a URL rule typed, the known provider for the Source URL is still asked (still once): an X post that never answers the worker still gets its title. The URL rule keeps the type; oEmbed only adds the title.

`GuardedOEmbedProvider` (`infrastructure/http/`) implements the port over the `IJsonFetcher` port (`WORKER_TOKENS.JsonFetcher`, the same `SafeUrlFetcher` instance as the page fetch, through its `fetchJson`): the same guard, redirect checks and 10-second timeout as the page fetch, JSON only, at most 64 KB (see [Security](./security.md#the-workers-url-fetch)). It reads only the answer's `type` and `title` (entities decoded); an answer without a title (X's) is titled by the text of the post its embed HTML quotes. `itemTypeFromOEmbed` types the answer:

| oEmbed `type` | Item type                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `video`       | Video                                                                                                                              |
| `photo`       | Image                                                                                                                              |
| `rich`        | the known provider's: Post (X, Reddit), Audio (Spotify, SoundCloud), Video (YouTube, Vimeo, TikTok); none from an unknown provider |
| `link`, other | none                                                                                                                               |

A discovery link pointing at a known provider's endpoint counts as that provider. A refused, failed, timed-out, non-JSON, oversized or unreadable answer never fails Processing: the page's other signals decide, as if there were no oEmbed. A response that isn't HTML (a file) asks nothing, and so does a failed page fetch for an Item without a known provider.

### Page rules

The fetcher parses an HTML head once, in infrastructure (`parsePageHead.ts`, htmlparser2), into a `PageHead` (`domain/entities/PageHead.ts`): its meta tags (keyed by `property`, else `name`, lower-case), its first `<title>`, each JSON-LD block that parses as JSON, and its oEmbed discovery links (absolute). Entities are decoded there. The domain rules read only these tags:

| Rule                                       | Declares                                                                                  | Item type |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | --------- |
| `itemTypeFromJsonLd` (`@type`)             | Article, NewsArticle, BlogPosting                                                         | Article   |
|                                            | VideoObject                                                                               | Video     |
|                                            | AudioObject, PodcastEpisode, MusicRecording                                               | Audio     |
|                                            | SoftwareSourceCode                                                                        | Code      |
|                                            | SocialMediaPosting, DiscussionForumPosting                                                | Post      |
|                                            | ImageObject, only when no other type above is declared (WebPage and the like don't count) | Image     |
| `itemTypeFromOpenGraph`                    | `og:type` article                                                                         | Article   |
|                                            | `og:type` `video.*`, or (when `og:type` says nothing above) an `og:video` tag             | Video     |
|                                            | `og:type` `music.*`                                                                       | Audio     |
| `itemTypeFromTwitterCard` (`twitter:card`) | `player`                                                                                  | Video     |
|                                            | `photo`                                                                                   | Image     |

JSON-LD nodes are read at the top level, in arrays and in `@graph`, in document order (the first recognised type wins), never inside properties; `schema:Article` and `https://schema.org/Article` count as `Article`.

**Title and description** (`domain/rules/pageMetadata.ts`), each field on its own, from the first source with a non-blank value: the oEmbed title (oEmbed has no description), then Open Graph (`og:title`, `og:description`), then Twitter Card (`twitter:title`, `twitter:description`), then the page (`<title>`, `<meta name="description">`). Whitespace is collapsed; the title is capped at 300 characters and the description at 1000 (cut with an ellipsis). A response that isn't HTML gives neither; a 4xx answer or a failed fetch gives only what a known oEmbed provider says. They are written to the Item's `title` and `description` columns as it becomes Ready.

What else it builds on:

- **The Redis connection.** `@cue-memory/db/redis` exports `redisConnection`, built once with `maxRetriesPerRequest: null` because BullMQ's blocking commands need it. The API's Items queue uses it directly; the rate-limit store uses its own fail-fast duplicate of it (see [Security](./security.md#rate-limiting)).
- **The Items domain and output.** The `Item` and `Tag` entities, the Tag name rule and the Item card output are in `apps/api` (see [Clean Architecture](./clean-architecture.md#the-four-layers)), and the `items`, `tags` and `item_tags` tables are in `packages/db` (see [Database](./database.md)).

### Thumbnails

Implemented for **Image Items** and **HTML pages**. The candidates, best first, come from one pure rule, `domain/rules/thumbnailCandidates.ts`, the one place the order is written down: for an Image Item whose fetch ended at the image file, only that final URL; for an HTML page, its head's `og:image`, then its `twitter:image` (from the head the page fetch already read, so no extra request). Each value is made absolute against the final URL after redirects, blank values and ones that aren't http(s) (`data:`, `javascript:` …) are dropped, and an image offered twice is tried once. Other files, unsuccessful answers and failed page fetches have no candidate (an oEmbed `thumbnail_url` is not a candidate yet). Processing tries the candidates in order and keeps the first that works ([ADR 0002](./contexts/items/adr/0002-thumbnails-are-resized-by-the-worker-and-kept-in-private-supabase-storage.md)):

1. **Download** each candidate in turn through the `IImageFetcher` port, bound to the same `SafeUrlFetcher` as the page (`fetchImage`): guarded, at most 5 MB, only JPEG, PNG, WebP, GIF or AVIF whose Content-Type and magic bytes agree (see [Security](./security.md#the-workers-url-fetch)). An Image Item's image is downloaded again in full; the page fetch read only its first 16 bytes.
2. **Resize** through `IThumbnailResizer`, `SharpThumbnailResizer` (sharp): turned by its EXIF orientation, at most 800px wide (never enlarged), WebP, all metadata stripped, the first frame of an animated image; an image declaring more than 40 megapixels, an undecodable one, or one sharp decodes as another format (SVG, TIFF, HEIC …) is refused.
3. **Store** through `IThumbnailStore`, `SupabaseThumbnailStore`: an upsert to `{userId}/{itemId}.webp` (`domain/rules/thumbnailKey.ts`) in the private `thumbnails` bucket, as `image/webp`, so a retry or a reprocess overwrites the same object.

The key goes to `items.thumbnail_key` in the same update as the type, title and description. A refused or failed download or an image that can't be resized moves on to the next candidate; a failed upload ends the attempt (the store, not the image, is at fault). None of these fails Processing or retries the job: with no candidate left, the Item goes Ready with no Thumbnail. Without `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` the container binds `NoThumbnailStore` instead, and Processing downloads no image at all. The bucket is created once by hand (see [Getting Started](./getting-started.md#thumbnail-storage)).

## Not yet built

The worker follows the same layering as the API (see [Clean Architecture](./clean-architecture.md#the-worker)). Thumbnails from an oEmbed `thumbnail_url`, text extraction (PDFs, article bodies) and the AI tag-suggestion call are not implemented; see product plan section 6 for the intended scope. Why an Item failed is logged by the worker with the Item id, not stored (see [Database](./database.md#schema)).
