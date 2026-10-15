import { Parser } from "htmlparser2";
import type { MetaTag, OEmbedLink, PageHead } from "@/domain/entities/PageHead";

// A Map, so a type such as "constructor" never reads a prototype key.
const OEMBED_FORMATS = new Map<string, OEmbedLink["format"]>([
  ["application/json+oembed", "json"],
  ["text/xml+oembed", "xml"],
  ["application/xml+oembed", "xml"],
]);

/**
 * Parses an HTML page's head once into the tags the rules read: meta tags,
 * the title, JSON-LD blocks and oEmbed discovery links. Entities in
 * attributes and the title are decoded; JSON-LD that doesn't parse is
 * skipped. `pageUrl` (the final URL) makes discovery links absolute.
 */
export function parsePageHead(html: string, pageUrl: string): PageHead {
  const meta: MetaTag[] = [];
  const jsonLd: unknown[] = [];
  const oEmbedLinks: OEmbedLink[] = [];
  let title: string | null = null;

  // The text of the element being read (a <title> or a JSON-LD <script>), if any.
  let reading: "title" | "json-ld" | null = null;
  let text = "";

  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "meta") {
        const key = (attributes.property ?? attributes.name)?.trim().toLowerCase();
        if (key && attributes.content !== undefined)
          meta.push({ key, content: attributes.content });
      } else if (name === "link") {
        const link = oEmbedLink(attributes, pageUrl);
        if (link) oEmbedLinks.push(link);
      } else if (name === "title" && title === null) {
        reading = "title";
        text = "";
      } else if (name === "script" && isJsonLd(attributes.type)) {
        reading = "json-ld";
        text = "";
      }
    },
    ontext(data) {
      if (reading) text += data;
    },
    onclosetag(name) {
      if (reading === "title" && name === "title") {
        title = text;
        reading = null;
      } else if (reading === "json-ld" && name === "script") {
        const block = parseJson(text);
        if (block !== undefined) jsonLd.push(block);
        reading = null;
      }
    },
  });
  parser.end(html);

  return { meta, title, jsonLd, oEmbedLinks };
}

function isJsonLd(type: string | undefined): boolean {
  return type?.split(";")[0]?.trim().toLowerCase() === "application/ld+json";
}

function oEmbedLink(attributes: Record<string, string>, pageUrl: string): OEmbedLink | null {
  const format = OEMBED_FORMATS.get(attributes.type?.trim().toLowerCase() ?? "");
  const rel = attributes.rel?.toLowerCase().split(/\s+/) ?? [];
  if (!format || !rel.includes("alternate") || !attributes.href) return null;
  try {
    return { url: new URL(attributes.href.trim(), pageUrl).href, format };
  } catch {
    return null;
  }
}

/** The JSON value, or undefined if the block isn't valid JSON. */
function parseJson(source: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }
}
