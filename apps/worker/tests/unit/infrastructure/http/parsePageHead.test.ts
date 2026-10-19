import { describe, expect, it } from "vitest";
import { parsePageHead } from "@/infrastructure/http/parsePageHead";

const PAGE_URL = "https://example.com/posts/hello";
const parse = (head: string) =>
  parsePageHead(`<!doctype html><html><head>${head}</head>`, PAGE_URL);

describe("parsePageHead", () => {
  it("extracts nothing from an empty head", () => {
    expect(parse("")).toEqual({ meta: [], title: null, jsonLd: [], oEmbedLinks: [] });
  });

  it("reads meta tags keyed by property, else name, lower-case, in document order", () => {
    const head = parse(`
      <meta property="OG:Type" content="article">
      <meta name="description" content="A page">
      <meta content='summary_large_image' name='twitter:card' />
      <meta property=og:title content=Hello>
      <meta charset="utf-8">
      <meta name="keywords">
    `);

    expect(head.meta).toEqual([
      { key: "og:type", content: "article" },
      { key: "description", content: "A page" },
      { key: "twitter:card", content: "summary_large_image" },
      { key: "og:title", content: "Hello" },
    ]);
  });

  it("decodes entities in meta content and the title", () => {
    const head = parse(`
      <title>Tom &amp; Jerry &#8211; &quot;The Movie&quot;</title>
      <meta property="og:title" content="It&#39;s &lt;fine&gt; &eacute;t&eacute;">
    `);

    expect(head.title).toBe('Tom & Jerry – "The Movie"');
    expect(head.meta).toEqual([{ key: "og:title", content: "It's <fine> été" }]);
  });

  it("keeps the first title only", () => {
    expect(parse("<title>First</title><title>Second</title>").title).toBe("First");
  });

  it("reads a title that contains markup-like text as text", () => {
    expect(parse("<title>a <b> c</title>").title).toBe("a <b> c");
  });

  it("parses each JSON-LD block and skips the ones that aren't JSON", () => {
    const head = parse(`
      <script type="application/ld+json">{"@type": "NewsArticle", "headline": "A &amp; B"}</script>
      <script type="application/ld+json">{ not json }</script>
      <script type="Application/LD+JSON; charset=utf-8">[{"@type": "VideoObject"}]</script>
      <script type="text/javascript">{"@type": "Article"}</script>
      <script>var x = 1;</script>
    `);

    // Script text is raw: entities stay as written, like a browser reads it.
    expect(head.jsonLd).toEqual([
      { "@type": "NewsArticle", headline: "A &amp; B" },
      [{ "@type": "VideoObject" }],
    ]);
  });

  it("doesn't read tags inside a script as tags", () => {
    const head = parse(
      `<script>document.write('<meta property="og:type" content="article">')</script>`,
    );

    expect(head.meta).toEqual([]);
  });

  it("reads oEmbed discovery links, made absolute", () => {
    const head = parse(`
      <link rel="alternate" type="application/json+oembed" href="/oembed?url=x&amp;format=json" title="Hello">
      <link rel="alternate" type="text/xml+oembed" href="https://example.com/oembed.xml">
      <link rel="alternate" type="application/rss+xml" href="/feed">
      <link rel="stylesheet" type="application/json+oembed" href="/not-oembed">
      <link rel="alternate" type="application/json+oembed">
    `);

    expect(head.oEmbedLinks).toEqual([
      { url: "https://example.com/oembed?url=x&format=json", format: "json" },
      { url: "https://example.com/oembed.xml", format: "xml" },
    ]);
  });
});
