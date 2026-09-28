import { injectable } from "inversify";
import type { FetchedMetadata, MetadataFetcher } from "../../domain/ports/metadata-fetcher";

/**
 * Placeholder implementation of the MetadataFetcher port — uses the URL's
 * hostname as the title. Replace with real extraction (Open Graph / oEmbed /
 * YouTube API / PDF text extraction) per the product plan's v1 scope; nothing
 * outside this file needs to change when that happens.
 */
@injectable()
export class StubMetadataFetcher implements MetadataFetcher {
  async fetch(sourceUrl: string): Promise<FetchedMetadata> {
    return { title: new URL(sourceUrl).hostname };
  }
}
