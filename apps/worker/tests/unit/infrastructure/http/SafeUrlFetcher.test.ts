import { describe, expect, it } from "vitest";
import type { FetchedPage } from "@/domain/providers/IUrlFetcher";
import { SafeUrlFetcher, UrlRefusedError } from "@/infrastructure/http/SafeUrlFetcher";
import { at, local, localFetcher, PNG_START, useLocalServer } from "../../../support/localServer";

useLocalServer();

// ARTICLE_HEAD's tags, parsed once by the fetcher (its oEmbed link resolved
// against the page it was read from, after any redirects).
const ARTICLE_TAGS = () => ({
  meta: [{ key: "og:type", content: "article" }],
  title: "An & article",
  jsonLd: [],
  oEmbedLinks: [{ url: at("/oembed.json"), format: "json" }],
});

/** The page's head, failing the test unless it is an HTML page. */
function headOf(page: FetchedPage) {
  if (page.kind !== "html") throw new Error(`Expected an HTML page, got ${page.kind}`);
  return page.head;
}

/** The file's first bytes, failing the test unless it is a file. */
function firstBytesOf(page: FetchedPage) {
  if (page.kind !== "file") throw new Error(`Expected a file, got ${page.kind}`);
  return page.firstBytes;
}

describe("SafeUrlFetcher, allowed fetches", () => {
  it("fetches an HTML page's head and sends the Resonory User-Agent", async () => {
    const page = await localFetcher().fetchPage(at("/article"));

    expect(page).toEqual({
      kind: "html",
      finalUrl: at("/article"),
      contentType: "text/html; charset=utf-8",
      head: ARTICLE_TAGS(),
    });
    expect(local.lastHeaders["user-agent"]).toBe(
      "Resonory/1.0 (+link preview; classifies saved links)",
    );
  });

  it("connects only to the checked address (site.test isn't in the real DNS)", async () => {
    await expect(localFetcher().fetchPage(at("/pdf"))).resolves.toEqual({
      kind: "file",
      finalUrl: at("/pdf"),
      contentType: "application/pdf",
      firstBytes: new Uint8Array(Buffer.from("%PDF-1.7")),
    });
    expect(local.hits).toEqual(["/pdf"]);
  });

  it("follows a redirect", async () => {
    const page = await localFetcher().fetchPage(at("/to-article"));

    expect(headOf(page)).toEqual(ARTICLE_TAGS());
    expect(page.finalUrl).toBe(at("/article"));
    expect(local.hits).toEqual(["/to-article", "/article"]);
  });

  it("reports the final URL after a chain of redirects", async () => {
    const page = await localFetcher().fetchPage(at("/short"));

    expect(page).toMatchObject({ finalUrl: at("/pdf"), contentType: "application/pdf" });
    expect(local.hits).toEqual(["/short", "/short-2", "/pdf"]);
  });

  it("reads only the first 16 bytes of a download", async () => {
    const page = await localFetcher().fetchPage(at("/download"));

    expect(page).toEqual({
      kind: "file",
      finalUrl: at("/download"),
      contentType: "application/octet-stream",
      firstBytes: new Uint8Array(PNG_START),
    });
  });

  it("stops after the first bytes of a download that never ends", async () => {
    const page = await localFetcher({ timeoutMs: 2000 }).fetchPage(at("/endless-binary"));

    expect(firstBytesOf(page)).toHaveLength(16);
    expect(Array.from(firstBytesOf(page).subarray(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xdf]);
  });

  it("follows up to 5 redirects", async () => {
    const page = await localFetcher().fetchPage(at("/chain/4"));

    expect(headOf(page)).toEqual(ARTICLE_TAGS());
    expect(local.hits).toHaveLength(6);
  });

  it("refuses a sixth redirect", async () => {
    await expect(localFetcher().fetchPage(at("/chain/5"))).rejects.toThrow(UrlRefusedError);
    expect(local.hits).toHaveLength(6);
  });

  it("stops reading after the size cap", async () => {
    const fetcher = localFetcher({ maxBytes: 64 * 1024 });

    expect(headOf(await fetcher.fetchPage(at("/title-after/60"))).title).toBe("Late");
    expect(headOf(await fetcher.fetchPage(at("/title-after/70")))).toEqual({
      meta: [],
      title: null,
      jsonLd: [],
      oEmbedLinks: [],
    });
  });

  it("stops reading the default ~1 MB in", async () => {
    expect(headOf(await localFetcher().fetchPage(at("/title-after/1000"))).title).toBe("Late");
    expect(headOf(await localFetcher().fetchPage(at("/title-after/1030"))).title).toBeNull();
  });

  it("reads what a head that never ends declared before the cap", async () => {
    const page = await localFetcher({ maxBytes: 64 * 1024 }).fetchPage(at("/endless"));

    expect(headOf(page).title).toBe("Endless");
  });

  it("times out when the server never answers", async () => {
    await expect(localFetcher({ timeoutMs: 200 }).fetchPage(at("/hang"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });

  it("times out when the body never finishes", async () => {
    await expect(localFetcher({ timeoutMs: 200 }).fetchPage(at("/hang-body"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });

  it("says nothing about a page that isn't there", async () => {
    await expect(localFetcher().fetchPage(at("/gone"))).resolves.toEqual({
      kind: "unsuccessful",
      finalUrl: at("/gone"),
      status: 404,
    });
  });

  it("fails on a server error, so the job retries", async () => {
    await expect(localFetcher().fetchPage(at("/broken"))).rejects.toThrow(/answered 503/);
  });
});

describe("SafeUrlFetcher, a response without a Content-Type", () => {
  const UNTYPED_TAGS = {
    meta: [{ key: "og:type", content: "video.other" }],
    title: "Untyped",
    jsonLd: [],
    oEmbedLinks: [],
  };

  it.each([
    ["a BOM, whitespace and a doctype", "/untyped-doctype"],
    ["an <html> tag in capitals", "/untyped-html"],
    ["a <head> tag", "/untyped-head"],
  ])("reads the head of a body starting with %s", async (_case, path) => {
    await expect(localFetcher().fetchPage(at(path))).resolves.toEqual({
      kind: "html",
      finalUrl: at(path),
      contentType: null,
      head: UNTYPED_TAGS,
    });
  });

  it("reads past the sniffing window up to </head>", async () => {
    const page = await localFetcher().fetchPage(at("/untyped-long-html"));

    expect(headOf(page).title).toBe("Long");
  });

  it.each([
    ["%PDF-1.4", "/untyped", "%PDF-1.4"],
    ["<header>", "/untyped-header", "<header>Not a do"],
    ["plain text", "/untyped-text", "plain text zzzzz"],
  ])("reads only the first bytes of a body starting with %s", async (_case, path, start) => {
    const page = await localFetcher().fetchPage(at(path));

    expect(page).toEqual({
      kind: "file",
      finalUrl: at(path),
      contentType: null,
      firstBytes: new Uint8Array(Buffer.from(start)),
    });
  });
});

describe("SafeUrlFetcher, refusals", () => {
  it.each([
    ["http://127.0.0.1:PORT/article", "loopback"],
    ["http://localhost:PORT/article", "loopback by name"],
    ["http://[::1]:PORT/article", "IPv6 loopback"],
    ["http://[::ffff:127.0.0.1]:PORT/article", "IPv4-mapped loopback"],
    ["http://2130706433:PORT/article", "loopback as a number"],
    ["http://0.0.0.0:PORT/article", "unspecified"],
    ["http://10.0.0.1/", "private"],
    ["http://172.16.0.1/", "private"],
    ["http://192.168.1.1/", "private"],
    ["http://169.254.169.254/latest/meta-data/", "the metadata service"],
    ["http://[fe80::1]/", "IPv6 link-local"],
    ["http://[fd00::1]/", "IPv6 unique local"],
    ["http://[::]/", "IPv6 unspecified"],
  ])("refuses %s (%s) with the real guard, never connecting", async (url) => {
    const fetcher = new SafeUrlFetcher();

    await expect(fetcher.fetchPage(url.replace("PORT", String(local.port)))).rejects.toThrow(
      UrlRefusedError,
    );
    expect(local.hits).toEqual([]);
  });

  it("refuses a host that resolves to a private address", async () => {
    await expect(localFetcher().fetchPage("http://internal.test/")).rejects.toThrow(
      /resolves to 10\.0\.0\.5/,
    );
  });

  it("refuses a host if any of its addresses is private", async () => {
    await expect(localFetcher().fetchPage("http://mixed.test/")).rejects.toThrow(
      /resolves to 192\.168\.0\.10/,
    );
  });

  it.each([
    ["/to-private", /10\.0\.0\.1/],
    ["/to-metadata", /169\.254\.169\.254/],
    ["/to-loopback-name", /loopback\.test resolves to ::1/],
  ])("refuses a redirect (%s) into the network", async (path, reason) => {
    await expect(localFetcher().fetchPage(at(path))).rejects.toThrow(reason);
    expect(local.hits).toEqual([path]);
  });

  it("refuses a redirect to anything but http(s)", async () => {
    await expect(localFetcher().fetchPage(at("/to-file"))).rejects.toThrow(UrlRefusedError);
  });

  it("refuses a URL that isn't http(s)", async () => {
    await expect(localFetcher().fetchPage("ftp://site.test/file")).rejects.toThrow(UrlRefusedError);
  });
});
