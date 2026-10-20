# Thumbnails are resized by the worker and kept in private Supabase Storage

A Thumbnail is a copy CueMemory keeps, never a link to the original picture: the original can change, vanish or track whoever loads it. During Processing the worker downloads the candidate image itself, through the same guard as the page fetch (public addresses only, pinned DNS, every redirect re-checked, the same timeout, JPEG/PNG/WebP/GIF/AVIF whose Content-Type and magic bytes agree, at most 5 MB). It resizes the image with sharp to a card Thumbnail (WebP, at most 800px wide, never enlarged, turned by its EXIF orientation, all metadata stripped, the first frame of an animated image, with a cap on decoded pixels), and uploads it to the private Supabase Storage bucket `thumbnails` at `{userId}/{itemId}.webp`, upserting so a retry overwrites. `items.thumbnail_key` holds that path, written in the same update that marks the Item Ready. The API turns it into a signed link with no transformation. A Thumbnail that can't be made never fails Processing: a refused or failed download, an undecodable image or a failed upload leaves the Item Ready without one, and the job isn't retried for it.

## Considered Options

- **ImageKit** (the first plan): a free tier with on-the-fly transformations. But the simplest integration hands ImageKit the original URL to fetch, which moves the fetch outside our guard, and it adds a second provider and account next to the dev database's.
- **S3 or Cloudflare R2**: cheap and standard, but another provider, another set of credentials, and resizing we'd build anyway.
- **Supabase Storage with its image transformations**: the same provider as the dev database, but transformations need a paid plan. Resizing in the worker with sharp costs nothing and keeps one stored size.
- **A public bucket**: simpler links, but anyone with the path sees a User's saved pictures. A private bucket with short-lived signed links keeps them as private as the Items.
- **Failing or retrying Processing when the Thumbnail fails**: a Thumbnail is decoration. Retrying the whole job for it would re-fetch the page and re-ask oEmbed, and a Failed Item for a missing picture would hide a perfectly good title and type.

## Consequences

- The bucket `thumbnails` is created once by hand, private; the worker never creates it. The worker needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, a key that bypasses row-level security and so lives only on the server. Without them the worker still runs, downloads no images, and every Item is Ready without a Thumbnail.
- sharp (libvips, a native module) runs in the worker on untrusted images, so it accepts only the five formats, even though sharp could decode SVG, TIFF or HEIC, and refuses an image declaring more pixels than the cap before decoding it.
- One stored size, the card's (800px wide). A larger view later is a new size and a backfill, not a URL parameter.
- The image is downloaded twice for an Image Item: the page fetch reads only its first bytes to type it, then the Thumbnail download reads the whole file.
- Candidates come in a list, best first, from one pure rule (`thumbnailCandidates`): an Image's final URL, or the oEmbed answer's `thumbnail_url`, then a page's `og:image`, then its `twitter:image`. Every candidate goes through the guard, so a page or an oEmbed answer can't point the worker at an internal address through its image.
- Deleting an Item or a User must also delete its Thumbnail object: Postgres cascades don't reach Storage.
