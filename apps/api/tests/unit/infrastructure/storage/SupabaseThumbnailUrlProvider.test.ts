import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import {
  SupabaseThumbnailUrlProvider,
  type SignedUrlResult,
  type ThumbnailStorage,
} from "@/infrastructure/storage/SupabaseThumbnailUrlProvider";

const key = "user-1/item-1.webp";
const signedUrl =
  "https://project.supabase.co/storage/v1/object/sign/thumbnails/user-1/item-1.webp?token=t";

// A fake Storage client that records which bucket, path and expiry (and nothing else) were signed.
const storageAnswering = (answer: SignedUrlResult) => {
  const createSignedUrl = vi.fn(async () => answer);
  const from = vi.fn(() => ({ createSignedUrl }));
  return { storage: { from } satisfies ThumbnailStorage, from, createSignedUrl };
};

describe("SupabaseThumbnailUrlProvider", () => {
  it("signs the Thumbnail key in the thumbnails bucket for 1 hour, with no transformation", async () => {
    const fake = storageAnswering({ data: { signedUrl }, error: null });

    const url = await new SupabaseThumbnailUrlProvider(fake.storage).resolve(key);

    expect(url).toBe(signedUrl);
    expect(fake.from).toHaveBeenCalledWith("thumbnails");
    expect(fake.createSignedUrl).toHaveBeenCalledWith(key, 3600);
  });

  // One missing object (or a bad key) mustn't break a whole list of cards.
  it("signs no link when Supabase Storage refuses to sign the key", async () => {
    const fake = storageAnswering({ data: null, error: new Error("Object not found") });

    await expect(new SupabaseThumbnailUrlProvider(fake.storage).resolve(key)).resolves.toBeNull();
  });
});
