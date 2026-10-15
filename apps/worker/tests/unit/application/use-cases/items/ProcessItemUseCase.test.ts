import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import type { Item, ItemType } from "@/domain/entities/Item";
import type { FetchedPage, IUrlFetcher } from "@/domain/providers/IUrlFetcher";
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
    markFailed: vi.fn(async () => {}),
  };
  return { repository, item };
}

// A URL fetcher answering every fetch with the same page.
function fetcherAnswering(page: FetchedPage) {
  return { fetchPage: vi.fn(async (_url: string) => page) } satisfies IUrlFetcher;
}

const anHtmlPage: FetchedPage = { contentType: "text/html", htmlHead: "<head></head>" };

describe("ProcessItemUseCase", () => {
  it("marks a saved YouTube link Ready as a Video", async () => {
    const { repository, item } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(repository, fetcherAnswering(anHtmlPage));

    const result = await useCase.execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(result).toEqual({ outcome: "ready", type: "video" });
    expect(item).toMatchObject({ status: "ready", type: "video" });
  });

  it("doesn't fetch a URL a rule recognises", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const fetcher = fetcherAnswering(anHtmlPage);

    await new ProcessItemUseCase(repository, fetcher).execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(fetcher.fetchPage).not.toHaveBeenCalled();
  });

  it.each([
    [{ contentType: "application/pdf", htmlHead: null }, "pdf"],
    [{ contentType: "image/webp", htmlHead: null }, "image"],
    [
      {
        contentType: "text/html",
        htmlHead: '<head><meta property="og:type" content="article"></head>',
      },
      "article",
    ],
    [anHtmlPage, "link"],
  ] as [FetchedPage, ItemType][])(
    "fetches a URL no rule recognises and types it by the response (%o → %s)",
    async (page, type) => {
      const { repository, item } = itemsInMemory("https://arxiv.org/pdf/2401.00001");
      const fetcher = fetcherAnswering(page);

      const result = await new ProcessItemUseCase(repository, fetcher).execute({
        itemId: ITEM_ID,
        userId: USER_ID,
      });

      expect(fetcher.fetchPage).toHaveBeenCalledWith("https://arxiv.org/pdf/2401.00001");
      expect(result).toEqual({ outcome: "ready", type });
      expect(item).toMatchObject({ status: "ready", type });
    },
  );

  it("fails when the fetch fails, so the job is retried", async () => {
    const { repository, item } = itemsInMemory("http://127.0.0.1:4000/health");
    const fetcher: IUrlFetcher = {
      fetchPage: vi.fn(async () => {
        throw new Error("127.0.0.1 isn't public");
      }),
    };

    await expect(
      new ProcessItemUseCase(repository, fetcher).execute({ itemId: ITEM_ID, userId: USER_ID }),
    ).rejects.toThrow("127.0.0.1 isn't public");
    expect(item).toMatchObject({ status: "processing", type: null });
  });

  it("does nothing for an Item that no longer exists", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(repository, fetcherAnswering(anHtmlPage));

    const result = await useCase.execute({
      itemId: "00000000-0000-4000-8000-000000000099",
      userId: USER_ID,
    });

    expect(result).toEqual({ outcome: "missing" });
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it("never touches another User's Item", async () => {
    const { repository, item } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(repository, fetcherAnswering(anHtmlPage));

    const result = await useCase.execute({ itemId: ITEM_ID, userId: OTHER_USER_ID });

    expect(result).toEqual({ outcome: "missing" });
    expect(item).toMatchObject({ status: "processing", type: null });
  });

  it("fails when the Item can't be marked Ready, so the job is retried", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    repository.markReady = vi.fn(async () => {
      throw new Error("Postgres is down");
    });
    const useCase = new ProcessItemUseCase(repository, fetcherAnswering(anHtmlPage));

    await expect(useCase.execute({ itemId: ITEM_ID, userId: USER_ID })).rejects.toThrow(
      "Postgres is down",
    );
  });
});
