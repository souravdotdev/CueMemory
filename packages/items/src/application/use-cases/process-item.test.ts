import { describe, expect, it, vi } from "vitest";
import type { ItemRepository } from "../../domain/ports/item-repository";
import type { MetadataFetcher } from "../../domain/ports/metadata-fetcher";
import { processItem } from "./process-item";

describe("processItem", () => {
  it("marks the item ready with the fetched title on success", async () => {
    const itemRepository: ItemRepository = {
      create: vi.fn(),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metadataFetcher: MetadataFetcher = {
      fetch: vi.fn().mockResolvedValue({ title: "Example Domain" }),
    };

    await processItem(
      { itemRepository, metadataFetcher },
      { itemId: "item-1", sourceUrl: "https://example.com" },
    );

    expect(metadataFetcher.fetch).toHaveBeenCalledWith("https://example.com");
    expect(itemRepository.updateStatus).toHaveBeenCalledWith("item-1", "ready", {
      title: "Example Domain",
    });
  });

  it("marks the item failed and rethrows when metadata fetching throws", async () => {
    const itemRepository: ItemRepository = {
      create: vi.fn(),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metadataFetcher: MetadataFetcher = {
      fetch: vi.fn().mockRejectedValue(new Error("fetch failed")),
    };

    await expect(
      processItem(
        { itemRepository, metadataFetcher },
        { itemId: "item-1", sourceUrl: "https://example.com" },
      ),
    ).rejects.toThrow("fetch failed");

    expect(itemRepository.updateStatus).toHaveBeenCalledWith("item-1", "failed");
    expect(itemRepository.updateStatus).not.toHaveBeenCalledWith(
      "item-1",
      "ready",
      expect.anything(),
    );
  });
});
