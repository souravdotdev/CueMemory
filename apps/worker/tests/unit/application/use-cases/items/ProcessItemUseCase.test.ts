import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import type { Item, ItemType } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OTHER_USER_ID = "0b6a1f7e-2c3d-4e5f-8a9b-1c2d3e4f5a6b";
const ITEM_ID = "00000000-0000-4000-8000-000000000001";

// An in-memory Item repository holding one Processing Item for USER_ID.
function itemsInMemory(sourceUrl: string) {
  const item: Item = { id: ITEM_ID, userId: USER_ID, sourceUrl, type: null, status: "processing" };
  const repository: IItemRepository = {
    findById: vi.fn(async (itemId: string, userId: string) =>
      itemId === item.id && userId === item.userId ? { ...item } : null,
    ),
    markReady: vi.fn(async (itemId: string, userId: string, type: ItemType) => {
      if (itemId === item.id && userId === item.userId) {
        item.status = "ready";
        item.type = type;
      }
    }),
  };
  return { repository, item };
}

describe("ProcessItemUseCase", () => {
  it("marks a saved YouTube link Ready as a Video", async () => {
    const { repository, item } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(repository);

    const result = await useCase.execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(result).toEqual({ outcome: "ready", type: "video" });
    expect(item).toMatchObject({ status: "ready", type: "video" });
  });

  it("marks a URL no rule recognises Ready as a Link", async () => {
    const { repository, item } = itemsInMemory("https://example.com/blog/a-post");
    const useCase = new ProcessItemUseCase(repository);

    const result = await useCase.execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(result).toEqual({ outcome: "ready", type: "link" });
    expect(item).toMatchObject({ status: "ready", type: "link" });
  });

  it("does nothing for an Item that no longer exists", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(repository);

    const result = await useCase.execute({
      itemId: "00000000-0000-4000-8000-000000000099",
      userId: USER_ID,
    });

    expect(result).toEqual({ outcome: "missing" });
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it("never touches another User's Item", async () => {
    const { repository, item } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(repository);

    const result = await useCase.execute({ itemId: ITEM_ID, userId: OTHER_USER_ID });

    expect(result).toEqual({ outcome: "missing" });
    expect(item).toMatchObject({ status: "processing", type: null });
  });

  it("fails when the Item can't be marked Ready, so the job is retried", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    repository.markReady = vi.fn(async () => {
      throw new Error("Postgres is down");
    });
    const useCase = new ProcessItemUseCase(repository);

    await expect(useCase.execute({ itemId: ITEM_ID, userId: USER_ID })).rejects.toThrow(
      "Postgres is down",
    );
  });
});
