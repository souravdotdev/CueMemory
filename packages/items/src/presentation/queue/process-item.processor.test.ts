import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { ItemRepository } from "../../domain/ports/item-repository";
import type { MetadataFetcher } from "../../domain/ports/metadata-fetcher";
import type { ProcessItemJob } from "../../domain/ports/item-queue";
import type { ProcessItemDeps } from "../../application/use-cases/process-item";
import { createProcessItemHandler } from "./process-item.processor";

function fakeJob(data: ProcessItemJob): Job<ProcessItemJob> {
  return { data } as Job<ProcessItemJob>;
}

describe("createProcessItemHandler", () => {
  it("processes the job's item and returns its id", async () => {
    const itemRepository: ItemRepository = {
      create: vi.fn(),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metadataFetcher: MetadataFetcher = {
      fetch: vi.fn().mockResolvedValue({ title: "example.com" }),
    };
    const deps: ProcessItemDeps = { itemRepository, metadataFetcher };
    const handler = createProcessItemHandler(deps);

    const result = await handler(
      fakeJob({ itemId: "item-1", sourceUrl: "https://example.com", type: "article" }),
    );

    expect(metadataFetcher.fetch).toHaveBeenCalledWith("https://example.com");
    expect(itemRepository.updateStatus).toHaveBeenCalledWith("item-1", "ready", {
      title: "example.com",
    });
    expect(result).toEqual({ itemId: "item-1" });
  });

  it("lets a metadata-fetch failure propagate after marking the item failed", async () => {
    const itemRepository: ItemRepository = {
      create: vi.fn(),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metadataFetcher: MetadataFetcher = {
      fetch: vi.fn().mockRejectedValue(new Error("network error")),
    };
    const deps: ProcessItemDeps = { itemRepository, metadataFetcher };
    const handler = createProcessItemHandler(deps);

    await expect(
      handler(fakeJob({ itemId: "item-1", sourceUrl: "https://example.com", type: "article" })),
    ).rejects.toThrow("network error");

    expect(itemRepository.updateStatus).toHaveBeenCalledWith("item-1", "failed");
  });
});
