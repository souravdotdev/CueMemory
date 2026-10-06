# CueMemory — Product Plan

## 1. One-liner

Save anything you find online and forget about it. CueMemory organises it for you and brings it back **when you actually need it**: while you're browsing, searching or working on something related.

## 2. The Problem

People save constantly: articles, X posts, Instagram posts, links, images, PDFs, documents. They save them in different places: bookmarks, "saved" tabs in each app, screenshots, read-later lists, notes. Then they never open them again. By the next morning, they've forgotten they saved it at all.

Saving isn't the failure. **Retrieval is.** Every existing tool assumes you'll remember to come back and search. You won't, because you don't know what you've forgotten.

> Example: you save an X post about Agile principles. A week later you're searching the web for "agile retrospective formats", or for coding principles in general. The post you saved is exactly what you need, and nothing tells you it exists.

## 3. The Solution

CueMemory is a "save anything, never organise" library (like [mymind](https://mymind.com)) whose core job is **Resurfacing**: bringing forgotten saves back at the right moment. It resurfaces in four distinct ways:

| Form                  | Triggered by                                                | Example                                                                             |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Cue**               | What you're doing _outside_ CueMemory (searching, browsing) | You search "agile retrospective" and a small card says "You saved 2 things on this" |
| **Related Items**     | What you're looking at _inside_ CueMemory                   | Opening or saving an Item shows "You saved 3 similar things"                        |
| **Rediscover digest** | Time                                                        | A weekly email with a handful of forgotten Items worth a second look                |
| **Reminder**          | A moment _you_ chose                                        | "Remind me about this in 2 weeks"                                                   |

All four run on one idea: every Item is understood **by meaning** (AI tags plus embeddings), so "agile principles" and "coding principles" are recognised as related even when no words overlap.

## 4. Target User

**Anyone who saves things online and never goes back to them.** The product and messaging stay general, with no narrow launch niche. The pain is universal. Heavy savers (knowledge workers, developers, students, creators) will feel it most and are the natural early adopters, but copy speaks to the behaviour ("you saved it, you forgot it"), not to a profession.

## 5. Product Pillars

| Pillar                 | What it means                                                               | When           |
| ---------------------- | --------------------------------------------------------------------------- | -------------- |
| **Effortless capture** | Paste any link today, then one click from any page, then share from any app | V1 → V1.x → V3 |
| **Resurfacing**        | Saved Items come back when relevant: Related Items and digest, then Cues    | V1 → V1.x      |
| **Knowledge graph**    | See how everything you saved connects: clusters, graph view, smart spaces   | V2             |

No folders, ever: organisation is AI tags plus your own tags. There are no Collections to maintain.

## 6. Positioning & Competition

**mymind makes you search. CueMemory finds you.**

- **mymind**: the closest product. It has beautiful save-anything and AI tags, it's privacy-first and paid-only. But retrieval is still _pull_: you have to remember to open it and search. There's no contextual resurfacing.
- **Raindrop.io**: a strong bookmark manager with collections and tags. It has no meaning-based retrieval and no resurfacing.
- **Readwise Reader**: great for articles and highlights, with spaced-repetition review of highlights. It's weak for social posts and arbitrary links, and resurfacing is on a schedule, not triggered by context.
- **Mem**: AI knowledge base, but notes-first. Capture takes more effort, and it doesn't resurface based on what you're browsing.
- **Pocket**: shut down in 2025, which left mainstream "just save it" users looking for a home.

**The wedge:** nobody resurfaces your saves _in the moment you're working on the topic_. Cues are the reason to switch, and the reason to pay.

## 7. V1 — Launch scope (web app)

**In scope:**

- Accounts: Google sign-in.
- **Link capture** in the web app: paste any URL (article, X post, Instagram post, YouTube video, PDF link, any page).
- **Async processing**: type detection, metadata (title, description, thumbnail), readable text extraction.
- **AI tags**, which you can add to or remove. Manual tags work too.
- **Embeddings** for every Item, powering:
  - **Semantic search**: find by meaning, not only keywords. It also surfaces related-but-not-matching Items when you search.
  - **Related Items** on every Item and right after saving.
- **Rediscover digest**: a weekly email of forgotten Items.
- Grid view of your library, filterable by tag.

**Explicitly out of V1** (discipline that keeps launch shippable):

- Browser extension and Cues (V1.x)
- Reminders (V1.x)
- File uploads (images, PDFs, documents) and text notes (V1.x)
- Collections / folders (never, by design)
- Knowledge graph, clustering (V2)
- Mobile apps and share sheet (V3)

## 8. Roadmap after V1

**V1.x — Cues (the differentiator)**

- **Chrome extension**: one-click save from any page, plus **Cues**. When your search query or the page you're on matches saved Items, the extension icon shows a badge. For strong matches, a small card slides in, rate-limited so it never nags.
- **Reminders**: pick a moment for an Item to come back.
- **Uploads**: images, PDFs, documents. **Text notes**.
- Cue feedback ("not useful") to tune matching.

**V2 — Knowledge graph**

- Topic clustering across your library.
- Graph view of how Items connect.
- Smart spaces (auto-grouped topics, not folders you maintain).
- Bidirectional links between Items.

**V3 — Capture everywhere**

- Mobile apps with a share sheet (where most X and Instagram saving actually happens).
- Safari and Firefox extensions.
- AI summaries (TL;DR), OCR for images, import tools (browser bookmarks, Pocket export, Pinterest).

## 9. Core User Flows

**Save:** paste a URL → the Item appears instantly as _Processing_ → a worker detects the type, fetches metadata and text, generates AI tags and an embedding → the Item becomes _Ready_ and Related Items appear.

**Related Items:** open any Item → see the most similar saved Items by meaning.

**Rediscover digest:** once a week → pick a few Ready Items the User hasn't opened in a while, varied across topics → email → one click opens the Item.

**Cue (V1.x):** the User searches or opens a page → the extension sends only the search query or page title → the server embeds it and compares it with the User's Items → above a confidence threshold, and within rate limits, it returns matches → badge count, plus a corner card for strong matches → click opens the Item. Every Cue records whether it was shown and whether it was opened.

## 10. Data Model (core entities)

- **User**: Google identity, display name, email, avatar. Soft-deleted with a 30-day grace period.
- **Item**: Source URL, Item type, status (Processing / Ready / Failed), title, description, Thumbnail, extracted text.
- **Tag**: per User, applied to Items by the AI or by the User.
- **Embedding**: meaning vector for each Item, which powers search, Related Items and Cues.
- **Cue** (V1.x): which Item was surfaced, what triggered it (a query or page title, stored minimally), and whether it was shown, opened or dismissed.
- **Reminder** (V1.x): an Item plus the moment chosen, and whether it was sent.
- **Digest**: which Items were sent to a User and when, so they aren't repeated and opens can be measured.

There are no Collections. Organisation is tags only.

## 11. Technical Architecture

- **Web app**: Next.js.
- **API**: Fastify. Every request and response goes through the shared zod contracts package (ADR 0001).
- **Worker**: BullMQ on Redis. It handles processing, AI tagging, embeddings, digest sending, and Reminders later. Saving never waits on slow work.
- **Postgres + pgvector**: all structured data plus embeddings. No separate vector database at this scale.
- **Object storage** (S3-compatible, private bucket): Thumbnails, served through short-lived signed URLs, and uploads later.
- **Chrome extension** (V1.x): saves Items and sends Cue signals (search queries and page titles only, see ADR 0002). Matching runs on the server against the User's embeddings.
- **Email**: a transactional provider for the digest and, later, Reminders.

## 12. Privacy Principles

A product that watches what you browse only works if it earns trust:

- No ads, no tracking SDKs, no selling data.
- The extension sends **only search queries and page titles**, never page content. It's off in incognito, with a site blocklist and a one-click pause (ADR 0002).
- Your library is private: private storage, signed links that expire, and data scoped to each User.
- Account deletion is real: 30-day grace period, then permanent purge.

## 13. Business Model — Freemium

**Free:** capped library (for example 100–150 Items), AI tags, semantic search, Related Items, Rediscover digest.

**Paid (about $6–10 / month):** unlimited Items, **the extension and Cues**, Reminders, priority processing, and upcoming features (graph, uploads).

The free tier proves the pain ("I really do forget what I save"). Cues are the moment the product feels magical, and that's what people pay for. Validate the price against real AI and embedding cost per User once there's usage data.

## 14. Key Risks

- **Cue fatigue**: resurfacing that feels like nagging drives Users away. Mitigate with high thresholds, rate limits, once per Item per topic, and a "not useful" button. Track dismiss rate.
- **Extension trust and store review**: a browsing-aware extension faces scrutiny from both Users and the Chrome Web Store. The narrow data boundary (ADR 0002) and clear permission copy are essential.
- **Extraction reliability**: paywalls, JS-heavy pages, and X and Instagram login walls or terms of service. This is the unglamorous 40% of the build.
- **AI cost per Item**: tagging plus embedding for every save, and an embedding for every Cue signal. Batch, cache, and watch margins.
- **Scope creep**: V1 already contains semantic search, Related Items and the digest. Cues must wait for V1.x.

## 15. Success Metrics

- **North star: resurfaced-and-opened rate.** The share of resurfaced Items (Cues, Related Items, digest, Reminders) the User opens. It directly measures "saved things come back when useful".
- Weekly active savers (Users who save at least one Item a week).
- Week-4 retention.
- Cue dismiss rate (a fatigue guardrail, V1.x).
- Free-to-paid conversion after the first Cue (V1.x).
