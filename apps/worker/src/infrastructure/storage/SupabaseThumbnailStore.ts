import type { SupabaseClient } from "@supabase/supabase-js";
import { injectable, unmanaged } from "inversify";
import type { IThumbnailStore } from "@/domain/providers/IThumbnailStore";

/** The private Supabase Storage bucket Thumbnails are kept in. Created once by hand (docs/getting-started.md); never by the worker. */
export const THUMBNAILS_BUCKET = "thumbnails";

/**
 * Keeps card Thumbnails in the private `thumbnails` bucket, through a
 * Supabase client signed in with the service role key. Each upload upserts
 * its fixed key as `image/webp`, so a retry overwrites instead of failing on
 * a duplicate. supabase-js answers a failed upload with an error instead of
 * throwing; it is thrown here so Processing sees the failure.
 */
@injectable()
export class SupabaseThumbnailStore implements IThumbnailStore {
  readonly keepsThumbnails = true;

  // Not injected: the container builds the client from the environment.
  constructor(@unmanaged() private readonly supabase: SupabaseClient) {}

  async put(key: string, thumbnail: Uint8Array): Promise<void> {
    const { error } = await this.supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(key, thumbnail, { contentType: "image/webp", upsert: true });
    if (error) {
      throw new Error(`Uploading ${THUMBNAILS_BUCKET}/${key} failed: ${error.message}`, {
        cause: error,
      });
    }
  }
}
