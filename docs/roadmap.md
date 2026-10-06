# Feature Roadmap

Versions match the [product plan](../product-plan.md). CueMemory is a mymind-style "save anything, never organise" library whose differentiator is **Resurfacing**: bringing forgotten saves back when they're relevant.

## V1 — Launch (web app)

1. **Accounts** — Google sign-in
2. **Link capture** — paste any URL (article, X post, Instagram post, YouTube video, PDF link, any page); every Item starts from a URL
3. **Async processing** — Item type, title, description, Thumbnail, readable text
4. **AI tags + manual tags** — no folders, no Collections
5. **Embeddings** for every Item
6. **Semantic search** — find by meaning, including related-but-not-matching Items
7. **Related Items** — similar saves shown on every Item and right after saving
8. **Rediscover digest** — weekly email of forgotten Items
9. **Grid view UI**, filterable by tag

## V1.x — Cues (the differentiator)

10. **Chrome extension** — one-click save from any page
11. **Cues** — the extension notices your search queries and page titles and surfaces matching saved Items (badge + rate-limited corner card)
12. **Cue feedback** — "not useful" to tune matching
13. **Reminders** — pick a moment for an Item to come back
14. **Uploads** — images, PDFs, documents
15. **Text notes** — Items with no Source URL
16. **Saving highlighted text** — capture a highlight + backlink to its source

## V2 — Knowledge graph

17. **Topic clustering** across the library
18. **Graph view** of how Items connect
19. **Smart spaces** — auto-grouped topics, never folders you maintain
20. **Bidirectional links** between Items
21. **Duplicate detection**

## V3 — Capture everywhere

22. **Mobile apps** (iOS, Android) with **share sheet** capture
23. **Safari and Firefox extensions**
24. **AI summaries (TL;DR)**
25. **Text recognition from images (OCR)**
26. **Import tools** — browser bookmarks, Pocket export, Pinterest, Instagram
27. **Save entire articles** (reader-mode archive) and full-page screenshots

## Later — long tail

- Search by date/brand/colour, pins / top of mind, focus mode
- Recipe, product and handwriting recognition
- Shareable spaces (public read-only links)
- Offline access, Apple Shortcuts and widgets

## Not a version — day-one principles

**Privacy-first, no ads, no tracking.** It shapes the data model and business model from V1: private storage with expiring links, data scoped to each User, real account deletion, and an extension that sends only search queries and page titles ([ADR 0002](./adr/0002-cues-send-only-search-queries-and-page-titles.md)).
