import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import type { Item, ItemRef, ItemType } from "@/domain/entities/Item";
import type { FetchedPage, IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OTHER_USER_ID = "0b6a1f7e-2c3d-4e5f-8a9b-1c2d3e4f5a6b";
const ITEM_ID = "00000000-0000-4000-8000-000000000001";

// An in-memory Item repository holding one Processing Item for USER_ID.
function itemsInMemory(sourceUrl: string) {
  const item: Item = { id: ITEM_ID, userId: USER_ID, sourceUrl, type: null, status: "processing" };
  const owns = ({ itemId, userId }: ItemRef) => itemId === item.id && userId === item.userId;
  const repository: IItemRepository = {
    findById: vi.fn(async (ref: ItemRef) => (owns(ref) ? { ...item } : null)),
    markReady: vi.fn(async (ref: ItemRef, type: ItemType) => {
      if (owns(ref)) {
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
  return { fetchPage: vi.fn(async (_sourceUrl: string) => page) } satisfies IUrlFetcher;
}

// A fetched page that ended at `finalUrl`, with nothing else to go on unless given.
const fetched = (fields: Partial<FetchedPage> = {}): FetchedPage => ({
  finalUrl: "https://arxiv.org/pdf/2401.00001",
  contentType: null,
  htmlHead: null,
  firstBytes: null,
  ...fields,
});

const anHtmlPage = fetched({ contentType: "text/html", htmlHead: "<head></head>" });

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
    [fetched({ contentType: "application/pdf", firstBytes: new Uint8Array() }), "pdf"],
    [fetched({ contentType: "image/webp", firstBytes: new Uint8Array() }), "image"],
    [
      fetched({ contentType: "application/octet-stream", firstBytes: Buffer.from("%PDF-1.7") }),
      "pdf",
    ],
    [
      fetched({
        contentType: "text/html",
        htmlHead: '<head><meta property="og:type" content="article"></head>',
      }),
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

  it("types a short link by the URL it leads to", async () => {
    const { repository, item } = itemsInMemory("https://bit.ly/3xYz");
    const fetcher = fetcherAnswering(
      fetched({ ...anHtmlPage, finalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    );

    const result = await new ProcessItemUseCase(repository, fetcher).execute({
      itemId: ITEM_ID,
      userId: USER_ID,
    });

    expect(fetcher.fetchPage).toHaveBeenCalledWith("https://bit.ly/3xYz");
    expect(result).toEqual({ outcome: "ready", type: "video" });
    expect(item).toMatchObject({ status: "ready", type: "video" });
  });

  it("types a short link by the URL it leads to even when that page answers vaguely", async () => {
    const { repository } = itemsInMemory("https://t.co/abc123");
    const fetcher = fetcherAnswering(
      fetched({ finalUrl: "https://example.com/report.pdf", contentType: null }),
    );

    const result = await new ProcessItemUseCase(repository, fetcher).execute({
      itemId: ITEM_ID,
      userId: USER_ID,
    });

    expect(result).toEqual({ outcome: "ready", type: "pdf" });
  });

  it("prefers a rule on the final URL over the response", async () => {
    const { repository } = itemsInMemory("https://lnkd.in/eXyZ");
    const fetcher = fetcherAnswering(
      fetched({
        finalUrl: "https://youtu.be/dQw4w9WgXcQ",
        contentType: "text/html",
        htmlHead: '<head><meta property="og:type" content="article"></head>',
      }),
    );

    const result = await new ProcessItemUseCase(repository, fetcher).execute({
      itemId: ITEM_ID,
      userId: USER_ID,
    });

    expect(result).toEqual({ outcome: "ready", type: "video" });
  });

  it("never changes the Source URL", async () => {
    const { repository, item } = itemsInMemory("https://bit.ly/3xYz");
    const fetcher = fetcherAnswering(fetched({ finalUrl: "https://youtu.be/dQw4w9WgXcQ" }));

    await new ProcessItemUseCase(repository, fetcher).execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(item.sourceUrl).toBe("https://bit.ly/3xYz");
    expect(repository.markReady).toHaveBeenCalledWith(
      { itemId: ITEM_ID, userId: USER_ID },
      "video",
    );
  });

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
