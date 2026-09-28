import { describe, expect, it, vi } from "vitest";
import type { Item } from "@second-brain/types";
import type { ItemRepository } from "../../domain/ports/item-repository";
import type { ItemQueue } from "../../domain/ports/item-queue";
import { saveItem } from "./save-item";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    userId: "user-1",
    type: "article",
    sourceUrl: "https://example.com/some-article",
    status: "processing",
    title: null,
    thumbnailUrl: null,
    author: null,
    extractedText: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("saveItem", () => {
  it("creates the item with the type detected from the URL and status processing", async () => {
    const created = makeItem();
    const itemRepository: ItemRepository = {
      create: vi.fn().mockResolvedValue(created),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn(),
    };
    const itemQueue: ItemQueue = { enqueueProcessing: vi.fn().mockResolvedValue(undefined) };

    const result = await saveItem(
      { itemRepository, itemQueue },
      { userId: "user-1", url: "https://example.com/some-article" },
    );

    expect(itemRepository.create).toHaveBeenCalledWith({
      userId: "user-1",
      sourceUrl: "https://example.com/some-article",
      type: "article",
      status: "processing",
    });
    expect(result).toBe(created);
  });

  it("detects non-article types correctly before creating the item", async () => {
    const created = makeItem({ type: "tweet", sourceUrl: "https://x.com/someone/status/1" });
    const itemRepository: ItemRepository = {
      create: vi.fn().mockResolvedValue(created),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn(),
    };
    const itemQueue: ItemQueue = { enqueueProcessing: vi.fn().mockResolvedValue(undefined) };

    await saveItem(
      { itemRepository, itemQueue },
      { userId: "user-1", url: "https://x.com/someone/status/1" },
    );

    expect(itemRepository.create).toHaveBeenCalledWith(expect.objectContaining({ type: "tweet" }));
  });

  it("enqueues a processing job for the created item", async () => {
    const created = makeItem({ id: "item-42", sourceUrl: "https://example.com/thing" });
    const itemRepository: ItemRepository = {
      create: vi.fn().mockResolvedValue(created),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn(),
    };
    const itemQueue: ItemQueue = { enqueueProcessing: vi.fn().mockResolvedValue(undefined) };

    await saveItem(
      { itemRepository, itemQueue },
      { userId: "user-1", url: "https://example.com/thing" },
    );

    expect(itemQueue.enqueueProcessing).toHaveBeenCalledWith({
      itemId: "item-42",
      sourceUrl: "https://example.com/thing",
      type: "article",
    });
  });

  it("propagates a repository failure without enqueueing a job", async () => {
    const itemRepository: ItemRepository = {
      create: vi.fn().mockRejectedValue(new Error("insert failed")),
      findAllByUser: vi.fn(),
      updateStatus: vi.fn(),
    };
    const itemQueue: ItemQueue = { enqueueProcessing: vi.fn() };

    await expect(
      saveItem({ itemRepository, itemQueue }, { userId: "user-1", url: "https://example.com/x" }),
    ).rejects.toThrow("insert failed");

    expect(itemQueue.enqueueProcessing).not.toHaveBeenCalled();
  });
});
