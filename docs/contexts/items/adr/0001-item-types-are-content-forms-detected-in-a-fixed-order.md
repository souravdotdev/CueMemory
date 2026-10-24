# Item types are content forms, detected in a fixed order

An Item type says what form an Item's content takes (Article, Post, Video, Image, Audio, PDF, Code, File, Link), never which site it came from: a TikTok is a Video, a Reddit thread a Post, a Spotify track Audio. The type is stored in a Postgres enum and decided once, by the worker during Processing, from the first signal that answers, in this order: URL rules (the known-site table, then the file extension) on the Source URL as pasted, then on the final URL after redirects; a non-HTML response's Content-Type, then its magic bytes; oEmbed; the page's JSON-LD `@type`; Open Graph; Twitter Card; else Link. `itemTypeOf` in `apps/worker/src/application/use-cases/items/ProcessItemUseCase.ts` is the one place the order is written down. The title follows its own order: oEmbed, Open Graph, Twitter Card, then the page's `<title>`.

The order runs from the signal Resonory controls and can test to the ones the page asserts about itself. A URL rule is a fact we wrote down for a site whose shape we know; what the server sends (Content-Type, magic bytes) describes the bytes themselves; oEmbed is a provider's deliberate, structured answer and works behind login walls; JSON-LD, Open Graph and Twitter Card are page markup that SEO plugins fill with generic defaults (a WordPress homepage declaring `og:type` article, a Yoast page carrying an ImageObject for its featured image), so they come last.

## Considered Options

- **Per-site types** (YouTube, Tweet, Spotify …): matches how Users name things, but the list never ends, every new site is a migration, and search and filters can't group "things to watch" across sites. The Tweet type was renamed to Post for this reason.
- **Page declarations first**: the page knows itself best, in theory. In practice, generic SEO defaults would overrule a known YouTube or GitHub URL and make results depend on whichever plugin a site runs.
- **A score over all signals**: robust against one wrong signal, but hard to explain, test or debug ("why is this a Video?"), and the signals disagree rarely enough that a fixed order wins.

## Consequences

- Adding a site is a row in the known-site table (with its oEmbed endpoint on the same row, if it has one); adding an Item type is an enum migration in `packages/db` plus the API, worker, shared schema and web labels, kept in step by the schema-agreement tests. Existing Items are not reclassified when the rules change.
- A URL rule can't be overruled by anything the page says: a GitHub repository that declares itself an Article stays Code. A wrong row is fixed in the table, not by the page.
- oEmbed is asked at most once per Item, through the same guard as the page fetch, and its failure only falls through to the next signal; only a failed page fetch for an Item no URL rule typed can fail Processing.
- Changing the order is a change to this decision: it needs a new ADR, because it silently changes what new Items become.
