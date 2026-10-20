/**
 * Where card Thumbnails are kept (the private `thumbnails` bucket in Supabase
 * Storage). `put` writes to a fixed key, overwriting what is there, so a
 * retried or reprocessed Item never leaves a second file; it rejects when the
 * write fails. Without Supabase Storage configured the container binds a
 * stand-in whose `keepsThumbnails` is false, and Processing then fetches no
 * image at all.
 */
export interface IThumbnailStore {
  readonly keepsThumbnails: boolean;
  put(key: string, thumbnail: Uint8Array): Promise<void>;
}
