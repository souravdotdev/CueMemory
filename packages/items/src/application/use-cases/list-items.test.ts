import { describe, expect, it, vi } from "vitest";
import type { ItemWithRelations } from "@cue-memory/types";
import type { ItemRepository } from "../../domain/ports/item-repository";
import { listItems } from "./list-items";

describe("listItems", () => {
  it("delegates to the repository with the given userId and returns its result", async () => {
    const items: ItemWithRelations[] = [
      {
        id: "item-1",
        userId: "user-1",
        type: "article",
        sourceUrl: "https://example.com/a",
        status: "ready",
        title: "A",
        thumbnailUrl: null,
        author: null,
        extractedText: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        tags: [],
        collections: [],
      },
    ];
    const itemRepository: ItemRepository = {
      create: vi.fn(),
      findAllByUser: vi.fn().mockResolvedValue(items),
      updateStatus: vi.fn(),
    };

    const result = await listItems({ itemRepository }, { userId: "user-1" });

    expect(itemRepository.findAllByUser).toHaveBeenCalledWith("user-1");
    expect(result).toBe(items);
  });
});
