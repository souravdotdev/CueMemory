import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CreateItemResponseSchema } from "@cue-memory/shared/schemas/items";
import { SaveItemUseCase } from "@/application/use-cases/items/SaveItemUseCase";
import type { Item } from "@/domain/entities/Item";
import type { IQueueProvider } from "@/domain/providers/IQueueProvider";
import type { IItemRepository, NewItem } from "@/domain/repositories/IItemRepository";

const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

// An in-memory Item repository: every save is a new Processing Item with the next id.
function itemsInMemory() {
  const saved: Item[] = [];
  const repository: IItemRepository = {
    create: vi.fn(async ({ userId, sourceUrl }: NewItem) => {
      const createdAt = new Date("2026-04-01T00:00:00.000Z");
      const item: Item = {
        id: `00000000-0000-4000-8000-00000000000${saved.length + 1}`,
        userId,
        sourceUrl,
        type: null,
        status: "processing",
        title: null,
        description: null,
        thumbnailKey: null,
        extractedText: null,
        createdAt,
        updatedAt: createdAt,
      };
      saved.push(item);
      return item;
    }),
  };
  return { repository, saved };
}

const queueRecording = (): IQueueProvider => ({ enqueueProcessItem: vi.fn(async () => {}) });

describe("SaveItemUseCase", () => {
  it("stores the Source URL for the User as a Processing Item", async () => {
    const { repository, saved } = itemsInMemory();
    const useCase = new SaveItemUseCase(repository, queueRecording());

    await useCase.execute({ userId: USER_ID, url: "https://youtu.be/dQw4w9WgXcQ" });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      userId: USER_ID,
      sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
      status: "processing",
      type: null,
    });
  });

  it("enqueues the new Item's Processing with its id and its User's id", async () => {
    const { repository, saved } = itemsInMemory();
    const queue = queueRecording();
    const useCase = new SaveItemUseCase(repository, queue);

    await useCase.execute({ userId: USER_ID, url: "https://example.com/post" });

    expect(queue.enqueueProcessItem).toHaveBeenCalledOnce();
    expect(queue.enqueueProcessItem).toHaveBeenCalledWith({
      itemId: saved[0]!.id,
      userId: USER_ID,
    });
  });

  it("returns the Item card, still Processing with no Item type", async () => {
    const { repository } = itemsInMemory();
    const useCase = new SaveItemUseCase(repository, queueRecording());

    const card = await useCase.execute({ userId: USER_ID, url: "https://example.com/post" });

    expect(card).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      sourceUrl: "https://example.com/post",
      type: null,
      status: "processing",
      title: null,
      description: null,
      thumbnailUrl: null,
      failureMessage: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      tags: [],
    });
    expect(CreateItemResponseSchema.parse(card)).toEqual(card);
  });

  it("saves the same Source URL twice as two Items, each with its own Processing", async () => {
    const { repository, saved } = itemsInMemory();
    const queue = queueRecording();
    const useCase = new SaveItemUseCase(repository, queue);

    const first = await useCase.execute({ userId: USER_ID, url: "https://example.com/post" });
    const second = await useCase.execute({ userId: USER_ID, url: "https://example.com/post" });

    expect(saved).toHaveLength(2);
    expect(first.id).not.toBe(second.id);
    expect(queue.enqueueProcessItem).toHaveBeenCalledTimes(2);
  });

  it("fails when the Processing can't be enqueued", async () => {
    const { repository } = itemsInMemory();
    const queue: IQueueProvider = {
      enqueueProcessItem: vi.fn(async () => {
        throw new Error("Redis is down");
      }),
    };
    const useCase = new SaveItemUseCase(repository, queue);

    await expect(
      useCase.execute({ userId: USER_ID, url: "https://example.com/post" }),
    ).rejects.toThrow("Redis is down");
  });
});
