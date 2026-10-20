import { inject, injectable } from "inversify";
import { TOKENS } from "@/di/tokens";
import type { IThumbnailUrlProvider } from "@/domain/providers/IThumbnailUrlProvider";

/** What Supabase's Storage client answers when asked to sign a link. */
export type SignedUrlResult =
  { data: { signedUrl: string }; error: null } | { data: null; error: Error };

/**
 * The part of Supabase's Storage client this provider uses. The container binds
 * the production `StorageClient` to it, which checks the real client fits.
 */
export interface ThumbnailStorage {
  from(bucket: string): {
    createSignedUrl(path: string, expiresIn: number): Promise<SignedUrlResult>;
  };
}

// The private bucket the worker stores Thumbnails in; a key is the object's path inside it.
const THUMBNAILS_BUCKET = "thumbnails";
// In seconds. Long enough to keep a page of cards loaded, short enough that a leaked link dies.
const SIGNED_URL_EXPIRY = 60 * 60;

/**
 * Signs short-lived links to Thumbnails in Supabase Storage. Thumbnails are stored
 * card-sized, so no transformation is asked for (it needs a paid Supabase plan).
 */
@injectable()
export class SupabaseThumbnailUrlProvider implements IThumbnailUrlProvider {
  constructor(@inject(TOKENS.ThumbnailStorage) private readonly storage: ThumbnailStorage) {}

  async resolve(thumbnailKey: string): Promise<string> {
    const { data, error } = await this.storage
      .from(THUMBNAILS_BUCKET)
      .createSignedUrl(thumbnailKey, SIGNED_URL_EXPIRY);
    if (error) throw error;
    return data.signedUrl;
  }
}
