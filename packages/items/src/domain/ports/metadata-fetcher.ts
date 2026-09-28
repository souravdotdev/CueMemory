export interface FetchedMetadata {
  title: string | null;
}

/**
 * Port the worker's infrastructure must implement to fetch metadata for a
 * saved URL. The use-case layer depends only on this interface — never on
 * the specific extraction mechanism (HTTP client, Open Graph parser, etc.).
 */
export interface MetadataFetcher {
  fetch(sourceUrl: string): Promise<FetchedMetadata>;
}
