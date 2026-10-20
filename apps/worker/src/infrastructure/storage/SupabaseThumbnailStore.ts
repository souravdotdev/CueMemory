import type { StorageClient } from "@supabase/storage-js";
import { injectable, unmanaged } from "inversify";
import type { IThumbnailStore } from "@/domain/providers/IThumbnailStore";

/** The private Supabase Storage bucket Thumbnails are kept in. Created once by hand (docs/getting-started.md); never by the worker. */
export const THUMBNAILS_BUCKET = "thumbnails";

/**
 * Keeps card Thumbnails in the private `thumbnails` bucket, through Supabase's
 * Storage client sending the service role key. Each upload upserts its fixed
 * key as `image/webp`, so a retry overwrites instead of failing on a
 * duplicate. The client answers a failed upload with an error instead of
 * throwing; it is thrown here so Processing sees the failure.
 */
@injectable()
export class SupabaseThumbnailStore implements IThumbnailStore {
  // Not injected: the container builds the client from the environment.
  constructor(@unmanaged() private readonly storage: StorageClient) {}

  async put(key: string, thumbnail: Uint8Array): Promise<void> {
    const { error } = await this.storage
      .from(THUMBNAILS_BUCKET)
      .upload(key, thumbnail, { contentType: "image/webp", upsert: true });
    if (error) {
      throw new Error(`Uploading ${THUMBNAILS_BUCKET}/${key} failed: ${error.message}`, {
        cause: error,
      });
    }
  }
}
