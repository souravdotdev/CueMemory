import { describe, expect, it } from "vitest";
import type { FetchedPage } from "@/domain/providers/IUrlFetcher";
import { itemTypeFromResponse } from "@/domain/rules/itemTypeFromResponse";

const PDF_BYTES = Uint8Array.from(Buffer.from("%PDF-1.7\n"));
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const page = (fields: Partial<FetchedPage>): FetchedPage => ({
  finalUrl: "https://example.com/download",
  contentType: null,
  htmlHead: null,
  firstBytes: null,
  ...fields,
});

const html = (head: string) =>
  page({
    contentType: "text/html; charset=utf-8",
    htmlHead: `<!doctype html><html><head>${head}</head>`,
  });

describe("itemTypeFromResponse", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["image/png", "image"],
    ["audio/mpeg", "audio"],
    ["video/mp4", "video"],
    ["application/zip", "file"],
    ["application/json", "link"],
    ["text/plain", "link"],
  ] as const)("types a %s response as %s", (contentType, type) => {
    expect(itemTypeFromResponse(page({ contentType, firstBytes: new Uint8Array() }))).toBe(type);
  });

  it("trusts a specific Content-Type over the bytes", () => {
    expect(itemTypeFromResponse(page({ contentType: "video/mp4", firstBytes: PDF_BYTES }))).toBe(
      "video",
    );
  });

  it.each([
    ["application/octet-stream", PDF_BYTES, "pdf"],
    ["binary/octet-stream", PNG_BYTES, "image"],
    [null, PNG_BYTES, "image"],
    ["application/octet-stream", Uint8Array.from(Buffer.from("just text")), "link"],
  ] as const)("sniffs the bytes of a %s response", (contentType, firstBytes, type) => {
    expect(itemTypeFromResponse(page({ contentType, firstBytes }))).toBe(type);
  });

  it("doesn't sniff the bytes of a response that names another type", () => {
    expect(itemTypeFromResponse(page({ contentType: "text/plain", firstBytes: PDF_BYTES }))).toBe(
      "link",
    );
  });

  it("types an HTML page declaring og:type article as an Article", () => {
    expect(itemTypeFromResponse(html('<meta property="og:type" content="article" />'))).toBe(
      "article",
    );
  });

  it.each([
    ["content first", `<meta content="article" property="og:type">`],
    ["single quotes", `<meta property='og:type' content='Article'>`],
    ["unquoted", `<meta property=og:type content=article>`],
    ["name instead of property", `<meta name="og:type" content="article">`],
  ])("reads og:type with %s", (_case, tag) => {
    expect(itemTypeFromResponse(html(tag))).toBe("article");
  });

  it("types any other HTML page as a Link", () => {
    expect(itemTypeFromResponse(html('<meta property="og:type" content="website">'))).toBe("link");
    expect(itemTypeFromResponse(html("<title>No Open Graph</title>"))).toBe("link");
  });

  it("types a response with nothing to go on as a Link", () => {
    expect(itemTypeFromResponse(page({}))).toBe("link");
  });
});
