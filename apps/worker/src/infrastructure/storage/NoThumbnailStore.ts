import { injectable } from "inversify";
import type { IThumbnailStore } from "@/domain/providers/IThumbnailStore";

/**
 * The stand-in bound when Supabase Storage isn't configured (`SUPABASE_URL`
 * or `SUPABASE_SERVICE_ROLE_KEY` missing): it keeps nothing, so Processing
 * downloads no image and every Item goes Ready without a Thumbnail.
 */
@injectable()
export class NoThumbnailStore implements IThumbnailStore {
  readonly keepsThumbnails = false;

  async put(key: string): Promise<void> {
    throw new Error(`No Thumbnail store is configured, so ${key} can't be kept`);
  }
}
