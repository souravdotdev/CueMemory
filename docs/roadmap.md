# Feature Roadmap

Feature list derived from a competitive analysis of [mymind.com](https://mymind.com), ordered by priority and grouped by target version.

## V1 — MVP (core value prop must work before anything else)

1. **Save/capture items** — paste a link (article, tweet, video, image, PDF, or any other page); every item starts from a URL
2. **Basic keyword search**
3. **Manual tagging** — simplest organization primitive
4. **AI auto-tagging** — automatic organization alongside manual tags, the "no folders needed" pitch
5. **Sync across devices** — cloud backend, not local-only (table stakes for a "second brain")
6. **Accounts/auth**
7. **Grid/masonry view UI**

## V1.x — Fast follow (rounds out capture, still no AI)

8. **Note taking & text-note capture** — plain text/rich text notes as items with no source URL (moved from V1: the V1 item model is links only)
9. **Chrome extension** — quick save without opening the app
10. **Save entire articles** (reader-mode archive, not just a link)
11. **Full-page screenshot capture**
12. **PDF/document & image upload & storage**
13. **Full-text search** across saved article/document content
14. **Saving highlighted text** — capture a highlight + backlink to source

## V2 — Smart/differentiating features

15. **AI summaries (TLDR)**
16. **Text recognition from images (OCR)**
17. **Smart spaces** — auto-grouped collections
18. **Pins / Top of mind**
19. **Search by date/brand/multi-attribute**
20. **Search by color** — needs image color indexing, build after OCR/tagging infra exists
21. **Focus mode**
22. **Duplicate detection**

## V3 — Platform expansion & long-tail

23. **Bidirectional linking**
24. **Rediscover/resurface** ("on this day" style nudges)
25. **Shareable spaces** (public read-only links)
26. **Offline access**
27. **Recipe recognition**
28. **Product/shopping recognition** (price + image extraction)
29. **Handwriting recognition**
30. **Apple ecosystem** — Shortcuts, widgets, Share Sheet, native macOS app
31. **Import tools** — Pinterest, Instagram, Are.na

## V4 — Mobile apps

32. **iOS app**
33. **Android app**

## Not a version — a day-one architecture decision

**Privacy-first / no-ads / no-feed positioning** (and, if used as a differentiator, encryption-at-rest). This isn't a feature bolted on later — it shapes the data model and business model (e.g. paid-only, no ad SDKs) starting in V1; retrofitting it afterward is painful.
