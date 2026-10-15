import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import {
  type Item,
  type ItemMetadata,
  type ItemRef,
  type ItemType,
  NO_METADATA,
} from "@/domain/entities/Item";
import type { OEmbedLink, PageHead } from "@/domain/entities/PageHead";
import type { IOEmbedProvider, OEmbed } from "@/domain/providers/IOEmbedProvider";
import type { FetchedPage, IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OTHER_USER_ID = "0b6a1f7e-2c3d-4e5f-8a9b-1c2d3e4f5a6b";
const ITEM_ID = "00000000-0000-4000-8000-000000000001";
const REF = { itemId: ITEM_ID, userId: USER_ID };

// An in-memory Item repository holding one Processing Item for USER_ID.
function itemsInMemory(sourceUrl: string) {
  const item: Item & Partial<ItemMetadata> = {
    id: ITEM_ID,
    userId: USER_ID,
    sourceUrl,
    type: null,
    status: "processing",
  };
  const owns = ({ itemId, userId }: ItemRef) => itemId === item.id && userId === item.userId;
  const repository: IItemRepository = {
    findById: vi.fn(async (ref: ItemRef) => (owns(ref) ? { ...item } : null)),
    markReady: vi.fn(async (ref: ItemRef, type: ItemType, metadata: ItemMetadata) => {
      if (owns(ref)) Object.assign(item, { status: "ready", type, ...metadata });
    }),
    markFailed: vi.fn(async () => {}),
  };
  return { repository, item };
}

// A URL fetcher answering every fetch with the same page.
function fetcherAnswering(page: FetchedPage) {
  return { fetchPage: vi.fn(async (_sourceUrl: string) => page) } satisfies IUrlFetcher;
}

// A URL fetcher whose every fetch fails with `error`.
function fetcherFailing(error: Error) {
  return {
    fetchPage: vi.fn(async (_sourceUrl: string): Promise<FetchedPage> => {
      throw error;
    }),
  } satisfies IUrlFetcher;
}

// An oEmbed provider answering every request with the same answer.
function oEmbedsAnswering(answer: Partial<OEmbed>) {
  return {
    fetchOEmbed: vi.fn(async (_endpointUrl: string): Promise<OEmbed> => ({
      type: null,
      title: null,
      ...answer,
    })),
  } satisfies IOEmbedProvider;
}

// An oEmbed provider whose every request fails (refused, not JSON, too big …).
function oEmbedsFailing() {
  return {
    fetchOEmbed: vi.fn(async (_endpointUrl: string): Promise<OEmbed> => {
      throw new Error("oEmbed answered 404");
    }),
  } satisfies IOEmbedProvider;
}

const PAGE_URL = "https://example.com/page";

// An answer that says nothing about the page (a 404, a 403 behind a login wall …).
const unsuccessful = (finalUrl = PAGE_URL, status = 404): FetchedPage => ({
  kind: "unsuccessful",
  finalUrl,
  status,
});

// A 2xx answer that isn't HTML, starting with these bytes.
const file = (
  contentType: string | null,
  firstBytes: Uint8Array = new Uint8Array(),
  finalUrl = PAGE_URL,
): FetchedPage => ({ kind: "file", finalUrl, contentType, firstBytes });

// An HTML page whose head declares these meta tags, title and JSON-LD.
const htmlPage = (
  meta: Record<string, string> = {},
  {
    title = null,
    jsonLd = [],
    oEmbedLinks = [],
  }: Partial<Pick<PageHead, "title" | "jsonLd">> & { oEmbedLinks?: OEmbedLink[] } = {},
): FetchedPage => ({
  kind: "html",
  finalUrl: PAGE_URL,
  contentType: "text/html; charset=utf-8",
  head: {
    meta: Object.entries(meta).map(([key, content]) => ({ key, content })),
    title,
    jsonLd,
    oEmbedLinks,
  },
});

const run = (
  sourceUrl: string,
  fetcher: IUrlFetcher,
  oEmbeds: IOEmbedProvider = oEmbedsFailing(),
) => {
  const { repository, item } = itemsInMemory(sourceUrl);
  const useCase = new ProcessItemUseCase(repository, fetcher, oEmbeds);
  return { item, repository, result: useCase.execute(REF) };
};

describe("ProcessItemUseCase, Item type", () => {
  it("marks a saved YouTube link Ready as a Video", async () => {
    const { item, result } = run("https://youtu.be/dQw4w9WgXcQ", fetcherAnswering(htmlPage()));

    await expect(result).resolves.toMatchObject({ outcome: "ready", type: "video" });
    expect(item).toMatchObject({ status: "ready", type: "video" });
  });

  it("fetches every Item, even one a URL rule recognises", async () => {
    const fetcher = fetcherAnswering(htmlPage());

    await run("https://youtu.be/dQw4w9WgXcQ", fetcher).result;

    expect(fetcher.fetchPage).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ");
  });

  it.each([
    [file("application/pdf"), "pdf"],
    [file("image/webp"), "image"],
    [file("application/octet-stream", Buffer.from("%PDF-1.7")), "pdf"],
    [file("text/plain", Buffer.from("just text")), "link"],
    [htmlPage({}, { jsonLd: [{ "@type": "PodcastEpisode" }] }), "audio"],
    [htmlPage({ "og:type": "article" }), "article"],
    [htmlPage({ "twitter:card": "player" }), "video"],
    [htmlPage({ "og:type": "website" }, { title: "A homepage" }), "link"],
    [unsuccessful(), "link"],
  ] as [FetchedPage, ItemType][])(
    "types a URL no rule recognises by the response (%o → %s)",
    async (page, type) => {
      const fetcher = fetcherAnswering(page);
      const { item, result } = run("https://example.com/page", fetcher);

      await expect(result).resolves.toMatchObject({ outcome: "ready", type });
      expect(fetcher.fetchPage).toHaveBeenCalledWith("https://example.com/page");
      expect(item).toMatchObject({ status: "ready", type });
    },
  );

  it("types a short link by the URL it leads to", async () => {
    const page = { ...htmlPage(), finalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };

    const { result } = run("https://bit.ly/3xYz", fetcherAnswering(page));

    await expect(result).resolves.toMatchObject({ type: "video" });
  });

  it("types a short link by the URL it leads to even when that page answers vaguely", async () => {
    const page = file(null, new Uint8Array(), "https://example.com/report.pdf");

    const { result } = run("https://t.co/abc123", fetcherAnswering(page));

    await expect(result).resolves.toMatchObject({ type: "pdf" });
  });

  // Each row: what the page says, what it should become, and why.
  it.each([
    [
      "a rule on the pasted URL over the page's JSON-LD",
      "https://github.com/vercel/next.js",
      htmlPage({ "og:type": "article" }, { jsonLd: [{ "@type": "Article" }] }),
      "code",
    ],
    [
      "a rule on the final URL over the page's JSON-LD",
      "https://lnkd.in/eXyZ",
      {
        ...htmlPage({}, { jsonLd: [{ "@type": "NewsArticle" }] }),
        finalUrl: "https://youtu.be/dQw4w9WgXcQ",
      },
      "video",
    ],
    [
      "JSON-LD over Open Graph",
      "https://example.com/page",
      htmlPage({ "og:type": "article" }, { jsonLd: [{ "@type": "VideoObject" }] }),
      "video",
    ],
    [
      "JSON-LD over a Twitter Card",
      "https://example.com/page",
      htmlPage({ "twitter:card": "player" }, { jsonLd: [{ "@type": "BlogPosting" }] }),
      "article",
    ],
    [
      "Open Graph over a Twitter Card",
      "https://example.com/page",
      htmlPage({ "og:type": "music.song", "twitter:card": "player" }),
      "audio",
    ],
    [
      "Open Graph when JSON-LD declares nothing it knows",
      "https://example.com/page",
      htmlPage({ "og:video": "https://example.com/v.mp4" }, { jsonLd: [{ "@type": "WebPage" }] }),
      "video",
    ],
  ] as [string, string, FetchedPage, ItemType][])(
    "prefers %s",
    async (_case, sourceUrl, page, type) => {
      const { result } = run(sourceUrl, fetcherAnswering(page));

      await expect(result).resolves.toMatchObject({ outcome: "ready", type });
    },
  );

  it("never changes the Source URL", async () => {
    const page = unsuccessful("https://youtu.be/dQw4w9WgXcQ");
    const { item, repository, result } = run("https://bit.ly/3xYz", fetcherAnswering(page));

    await result;

    expect(item.sourceUrl).toBe("https://bit.ly/3xYz");
    expect(repository.markReady).toHaveBeenCalledWith(REF, "video", NO_METADATA);
  });
});

describe("ProcessItemUseCase, title and description", () => {
  it("writes the page's title and description to the Item when it becomes Ready", async () => {
    const page = htmlPage(
      { "og:title": "  The   real title ", description: "What it's about" },
      { title: "Site | The real title" },
    );

    const { item, repository, result } = run("https://example.com/page", fetcherAnswering(page));

    const metadata = { title: "The real title", description: "What it's about" };
    await expect(result).resolves.toEqual({ outcome: "ready", type: "link", metadata });
    expect(repository.markReady).toHaveBeenCalledWith(REF, "link", metadata);
    expect(item).toMatchObject({ status: "ready", ...metadata });
  });

  it("gives an Item a URL rule typed the page's title", async () => {
    const page = htmlPage({ "twitter:title": "Never Gonna Give You Up" });

    const { result } = run("https://youtu.be/dQw4w9WgXcQ", fetcherAnswering(page));

    await expect(result).resolves.toEqual({
      outcome: "ready",
      type: "video",
      metadata: { title: "Never Gonna Give You Up", description: null },
    });
  });

  it("reads Open Graph first, then the Twitter Card, then the page title", async () => {
    const page = htmlPage(
      { "twitter:title": "Card title", "og:description": "OG description" },
      { title: "Page title" },
    );

    const { result } = run("https://example.com/page", fetcherAnswering(page));

    await expect(result).resolves.toMatchObject({
      metadata: { title: "Card title", description: "OG description" },
    });
  });

  it("has no title or description for a response that isn't HTML", async () => {
    const page = file("application/pdf");

    const { repository, result } = run("https://example.com/paper", fetcherAnswering(page));

    await result;
    expect(repository.markReady).toHaveBeenCalledWith(REF, "pdf", NO_METADATA);
  });
});

const DISCOVERY = {
  url: "https://example.com/oembed?url=page&format=json",
  format: "json",
} as const;

describe("ProcessItemUseCase, oEmbed", () => {
  it("asks the page's oEmbed discovery link, once", async () => {
    const oEmbeds = oEmbedsAnswering({ type: "video" });

    const { result } = run(
      "https://example.com/page",
      fetcherAnswering(
        htmlPage({}, { oEmbedLinks: [DISCOVERY, { ...DISCOVERY, url: "https://example.com/2" }] }),
      ),
      oEmbeds,
    );

    await expect(result).resolves.toMatchObject({ type: "video" });
    expect(oEmbeds.fetchOEmbed).toHaveBeenCalledTimes(1);
    expect(oEmbeds.fetchOEmbed).toHaveBeenCalledWith(DISCOVERY.url);
  });

  it("asks a known provider's endpoint, chosen from the final URL, even behind a login wall", async () => {
    const oEmbeds = oEmbedsAnswering({ type: "rich", title: "A post on X" });
    const page = unsuccessful("https://x.com/someone/status/1234567890", 403);

    const { result } = run("https://t.co/abc123", fetcherAnswering(page), oEmbeds);

    await expect(result).resolves.toEqual({
      outcome: "ready",
      type: "post",
      metadata: { title: "A post on X", description: null },
    });
    expect(oEmbeds.fetchOEmbed).toHaveBeenCalledTimes(1);
    const endpoint = new URL(oEmbeds.fetchOEmbed.mock.calls[0]![0]);
    expect(endpoint.origin + endpoint.pathname).toBe("https://publish.twitter.com/oembed");
    expect(endpoint.searchParams.get("url")).toBe("https://x.com/someone/status/1234567890");
  });

  it.each([
    ["video", {}, "video"],
    ["photo", {}, "image"],
    ["rich", { url: "https://open.spotify.com/oembed?url=x", format: "json" as const }, "audio"],
  ] as const)("types a %s answer ahead of the page's JSON-LD", async (type, link, itemType) => {
    const page = htmlPage(
      { "og:type": "article" },
      { jsonLd: [{ "@type": "Article" }], oEmbedLinks: [{ ...DISCOVERY, ...link }] },
    );

    const { result } = run(
      "https://example.com/page",
      fetcherAnswering(page),
      oEmbedsAnswering({ type }),
    );

    await expect(result).resolves.toMatchObject({ type: itemType });
  });

  it.each([
    ["a link answer", oEmbedsAnswering({ type: "link" })],
    ["a rich answer from an unknown provider", oEmbedsAnswering({ type: "rich" })],
    ["a failed or refused call", oEmbedsFailing()],
  ])("falls through to the page's JSON-LD on %s", async (_case, oEmbeds) => {
    const page = htmlPage({}, { jsonLd: [{ "@type": "NewsArticle" }], oEmbedLinks: [DISCOVERY] });

    const { result } = run("https://example.com/page", fetcherAnswering(page), oEmbeds);

    await expect(result).resolves.toMatchObject({ outcome: "ready", type: "article" });
  });

  it("never lets a rule on the URL be overruled by oEmbed", async () => {
    const page = htmlPage({}, { oEmbedLinks: [DISCOVERY] });

    const { result } = run(
      "https://github.com/vercel/next.js",
      fetcherAnswering(page),
      oEmbedsAnswering({ type: "video" }),
    );

    await expect(result).resolves.toMatchObject({ type: "code" });
  });

  it("prefers the oEmbed title, with the page's description", async () => {
    const page = htmlPage(
      { "og:title": "OG title", "og:description": "OG description" },
      { title: "Page title", oEmbedLinks: [DISCOVERY] },
    );

    const { result } = run(
      "https://example.com/page",
      fetcherAnswering(page),
      oEmbedsAnswering({ type: "link", title: "  oEmbed   title " }),
    );

    await expect(result).resolves.toMatchObject({
      metadata: { title: "oEmbed title", description: "OG description" },
    });
  });

  it.each([
    ["has no title", oEmbedsAnswering({ type: "video", title: " " })],
    ["fails", oEmbedsFailing()],
  ])("reads the page's title when oEmbed %s", async (_case, oEmbeds) => {
    const page = htmlPage({ "og:title": "OG title" }, { oEmbedLinks: [DISCOVERY] });

    const { result } = run("https://example.com/page", fetcherAnswering(page), oEmbeds);

    await expect(result).resolves.toMatchObject({ metadata: { title: "OG title" } });
  });

  it("asks nothing when the page names no endpoint and no provider is known", async () => {
    const oEmbeds = oEmbedsAnswering({ type: "video" });

    const { result } = run("https://example.com/page", fetcherAnswering(htmlPage()), oEmbeds);

    await expect(result).resolves.toMatchObject({ type: "link" });
    expect(oEmbeds.fetchOEmbed).not.toHaveBeenCalled();
  });

  it("asks nothing about a response that isn't HTML", async () => {
    const oEmbeds = oEmbedsAnswering({ type: "video", title: "A title" });
    const page = file("application/pdf", new Uint8Array(), "https://www.youtube.com/watch?v=abc");

    const { result } = run("https://example.com/paper", fetcherAnswering(page), oEmbeds);

    await expect(result).resolves.toMatchObject({ metadata: NO_METADATA });
    expect(oEmbeds.fetchOEmbed).not.toHaveBeenCalled();
  });

  it.each([
    ["times out", new Error("Fetching https://x.com/… timed out after 10000 ms")],
    ["is rate limited", new Error("Fetching https://x.com/… answered 429")],
    ["fails", new Error("Fetching https://x.com/… answered 503")],
    [
      "is refused",
      Object.assign(new Error("x.com resolves to 10.0.0.1"), { name: "UrlRefusedError" }),
    ],
  ])("still asks a known provider, once, when the page fetch %s", async (_case, error) => {
    const oEmbeds = oEmbedsAnswering({ type: "video", title: "  A post   on X " });

    const { item, result } = run(
      "https://x.com/someone/status/1234567890",
      fetcherFailing(error),
      oEmbeds,
    );

    // The URL rule types it; oEmbed only titles it.
    const metadata = { title: "A post on X", description: null };
    await expect(result).resolves.toEqual({ outcome: "ready", type: "post", metadata });
    expect(item).toMatchObject({ status: "ready", type: "post", ...metadata });
    expect(oEmbeds.fetchOEmbed).toHaveBeenCalledTimes(1);
    const endpoint = new URL(oEmbeds.fetchOEmbed.mock.calls[0]![0]);
    expect(endpoint.origin + endpoint.pathname).toBe("https://publish.twitter.com/oembed");
    expect(endpoint.searchParams.get("url")).toBe("https://x.com/someone/status/1234567890");
  });

  it("marks a typed Item Ready without a title when the page fetch and oEmbed both fail", async () => {
    const { result } = run(
      "https://youtu.be/dQw4w9WgXcQ",
      fetcherFailing(new Error("offline")),
      oEmbedsFailing(),
    );

    await expect(result).resolves.toEqual({
      outcome: "ready",
      type: "video",
      metadata: NO_METADATA,
    });
  });

  it.each([
    ["a typed Item without a known provider", "https://github.com/vercel/next.js"],
    ["an untyped Item", "https://bit.ly/3xYz"],
  ])("asks nothing about %s when the page fetch fails", async (_case, sourceUrl) => {
    const oEmbeds = oEmbedsAnswering({ type: "video", title: "A title" });

    const { result } = run(sourceUrl, fetcherFailing(new Error("offline")), oEmbeds);

    await result.catch(() => {});
    expect(oEmbeds.fetchOEmbed).not.toHaveBeenCalled();
  });
});

describe("ProcessItemUseCase, failed fetches", () => {
  it.each([
    ["fails", new Error("Fetching https://youtu.be/dQw4w9WgXcQ answered 503")],
    [
      "is refused",
      Object.assign(new Error("youtu.be resolves to 10.0.0.1"), { name: "UrlRefusedError" }),
    ],
    ["times out", new Error("Fetching https://youtu.be/dQw4w9WgXcQ timed out after 10000 ms")],
  ])(
    "marks an Item a URL rule typed Ready without a title when the fetch %s",
    async (_case, error) => {
      const { item, repository, result } = run(
        "https://youtu.be/dQw4w9WgXcQ",
        fetcherFailing(error),
      );

      await expect(result).resolves.toEqual({
        outcome: "ready",
        type: "video",
        metadata: NO_METADATA,
      });
      expect(repository.markReady).toHaveBeenCalledWith(REF, "video", NO_METADATA);
      expect(item).toMatchObject({ status: "ready", type: "video", title: null });
    },
  );

  it("fails an untyped Item when the fetch fails, so the job is retried (then Failed as a Link)", async () => {
    const { item, repository, result } = run(
      "http://127.0.0.1:4000/health",
      fetcherFailing(new Error("127.0.0.1 isn't public")),
    );

    await expect(result).rejects.toThrow("127.0.0.1 isn't public");
    expect(repository.markReady).not.toHaveBeenCalled();
    expect(item).toMatchObject({ status: "processing", type: null });
  });

  it("fails when the Item can't be marked Ready, so the job is retried", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    repository.markReady = vi.fn(async () => {
      throw new Error("Postgres is down");
    });
    const useCase = new ProcessItemUseCase(
      repository,
      fetcherFailing(new Error("offline")),
      oEmbedsFailing(),
    );

    await expect(useCase.execute(REF)).rejects.toThrow("Postgres is down");
  });
});

describe("ProcessItemUseCase, missing Items", () => {
  it("does nothing for an Item that no longer exists", async () => {
    const { repository } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const fetcher = fetcherAnswering(htmlPage());
    const useCase = new ProcessItemUseCase(repository, fetcher, oEmbedsFailing());

    const result = await useCase.execute({
      itemId: "00000000-0000-4000-8000-000000000099",
      userId: USER_ID,
    });

    expect(result).toEqual({ outcome: "missing" });
    expect(fetcher.fetchPage).not.toHaveBeenCalled();
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it("never touches another User's Item", async () => {
    const { repository, item } = itemsInMemory("https://youtu.be/dQw4w9WgXcQ");
    const useCase = new ProcessItemUseCase(
      repository,
      fetcherAnswering(htmlPage()),
      oEmbedsFailing(),
    );

    const result = await useCase.execute({ itemId: ITEM_ID, userId: OTHER_USER_ID });

    expect(result).toEqual({ outcome: "missing" });
    expect(item).toMatchObject({ status: "processing", type: null });
  });
});
