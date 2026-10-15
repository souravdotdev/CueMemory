import { describe, expect, it } from "vitest";
import type { MetaTag, PageHead } from "@/domain/entities/PageHead";
import {
  documentMetadata,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  openGraphMetadata,
  pickMetadata,
  twitterCardMetadata,
} from "@/domain/rules/pageMetadata";

const head = (title: string | null, tags: Record<string, string> = {}): PageHead => ({
  meta: Object.entries(tags).map(([key, content]): MetaTag => ({ key, content })),
  title,
  jsonLd: [],
  oEmbedLinks: [],
});

// The order the use case reads them in, Open Graph first.
const metadataOf = (page: PageHead) =>
  pickMetadata([openGraphMetadata(page), twitterCardMetadata(page), documentMetadata(page)]);

const ALL_TAGS = {
  "og:title": "OG title",
  "og:description": "OG description",
  "twitter:title": "Card title",
  "twitter:description": "Card description",
  description: "Meta description",
};

describe("page metadata", () => {
  it.each([
    ["Open Graph first", ALL_TAGS, { title: "OG title", description: "OG description" }],
    [
      "then the Twitter Card",
      { ...ALL_TAGS, "og:title": "", "og:description": "  " },
      { title: "Card title", description: "Card description" },
    ],
    [
      "then the page title and meta description",
      { description: "Meta description" },
      { title: "Page title", description: "Meta description" },
    ],
    [
      "each field on its own",
      { "twitter:title": "Card title", "og:description": "OG description" },
      { title: "Card title", description: "OG description" },
    ],
    ["nothing when the page says nothing", {}, { title: "Page title", description: null }],
  ])("reads %s", (_case, tags, expected) => {
    expect(metadataOf(head("Page title", tags))).toEqual(expected);
  });

  it("is empty for a page with no title or tags", () => {
    expect(metadataOf(head(null))).toEqual({ title: null, description: null });
    expect(metadataOf(head("   \n "))).toEqual({ title: null, description: null });
  });

  it("collapses whitespace", () => {
    const page = head("\n  Hello,\t\n   world  ", { description: " one\n\ntwo   three " });

    expect(metadataOf(page)).toEqual({ title: "Hello, world", description: "one two three" });
  });

  it("caps the title at 300 and the description at 1000 characters", () => {
    const page = head("t".repeat(400), { description: "word ".repeat(400) });

    const { title, description } = metadataOf(page);

    expect(title).toHaveLength(MAX_TITLE_LENGTH);
    expect(title).toBe(`${"t".repeat(299)}…`);
    expect(description!.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(description).toMatch(/^word word .*word…$/);
  });

  it("keeps text exactly at the cap whole", () => {
    expect(metadataOf(head("t".repeat(300))).title).toBe("t".repeat(300));
  });

  it("never splits an emoji when cutting", () => {
    const title = metadataOf(head(`${"t".repeat(298)}😀😀`)).title!;

    expect(title).toBe(`${"t".repeat(298)}…`);
  });
});
