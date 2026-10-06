# Cues are triggered by search queries and page titles only, never page content

Cues surface saved Items while the User browses. To do that, the browser extension has to tell CueMemory something about what the User is doing. It sends only two signals: the query typed into a search engine (Google, Bing, DuckDuckGo) and the title of the page being viewed. It never sends page content, full URLs beyond what's needed to recognise a search, form data or browsing history. It's off in incognito, respects a User-managed site blocklist, and has a one-click pause. Matching runs on the server, where the signal is embedded and compared against that User's Item embeddings. A browsing-aware extension is only viable for a privacy-first product if what it shares is narrow, obvious and easy to explain on the permission screen.

## Considered Options

- **Send full page content**: the best matching quality, but it streams everything the User reads to a server. That breaks the privacy promise and makes Chrome Web Store review and User trust much harder.
- **On-device matching**: nothing leaves the browser. But it needs a local embedding model and a synced local index of the User's library, which is a large build for V1.x. Worth revisiting once the product is proven.
- **Search queries only**: the most private option, but it misses the "reading an article about X" moment, which is a large share of when a Cue would help.

## Consequences

- Cue quality is capped by how much a title or query says. Vague titles will produce fewer Cues. That's an acceptable trade-off, because false positives cost more than misses (Cue fatigue).
- Any future change that sends more than queries and titles is a change to this promise. It needs a new ADR and explicit User opt-in, not a silent upgrade.
- Stored Cue records keep only the minimal trigger text needed for feedback and metrics, and are subject to the same account-deletion purge as everything else.
