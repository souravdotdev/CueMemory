import { describe, expect, it } from "vitest";
import { itemTypeFromResponse } from "@/domain/rules/itemTypeFromResponse";

const html = (head: string) => ({
  contentType: "text/html; charset=utf-8",
  htmlHead: `<!doctype html><html><head>${head}</head>`,
});

describe("itemTypeFromResponse", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["Application/PDF; qs=0.001", "pdf"],
    ["image/png", "image"],
    ["image/jpeg", "image"],
    ["application/json", "link"],
    ["text/plain", "link"],
  ] as const)("types a %s response as %s", (contentType, type) => {
    expect(itemTypeFromResponse({ contentType, htmlHead: null })).toBe(type);
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

  it("types a response without a Content-Type as a Link", () => {
    expect(itemTypeFromResponse({ contentType: null, htmlHead: null })).toBe("link");
  });
});
