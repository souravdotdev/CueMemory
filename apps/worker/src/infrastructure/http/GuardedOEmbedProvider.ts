import { Parser } from "htmlparser2";
import { inject, injectable } from "inversify";
import { WORKER_TOKENS } from "@/di/tokens";
import type { IJsonFetcher } from "@/domain/providers/IJsonFetcher";
import type { IOEmbedProvider, OEmbed } from "@/domain/providers/IOEmbedProvider";
import { collapseWhitespace } from "@/domain/rules/collapseWhitespace";
import { parsedUrl } from "@/domain/rules/parsedUrl";

/**
 * Asks an oEmbed endpoint through the guarded JSON fetch (`IJsonFetcher`,
 * the same `SafeUrlFetcher` as the page fetch: address guard, pinning,
 * redirect checks and timeout, JSON only, at most 64 KB). Reads only the
 * answer's `type`, `title` and `thumbnail_url`; an answer without a title
 * (X's) is titled by the text of the post its embed quotes.
 */
@injectable()
export class GuardedOEmbedProvider implements IOEmbedProvider {
  constructor(@inject(WORKER_TOKENS.JsonFetcher) private readonly json: IJsonFetcher) {}

  async fetchOEmbed(endpointUrl: string): Promise<OEmbed> {
    const answer = await this.json.fetchJson(endpointUrl);
    if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
      throw new Error(`${endpointUrl} answered something that isn't an oEmbed object`);
    }
    const fields = answer as Record<string, unknown>;
    const type = stringOrNull(fields.type);
    const title = decoded(stringOrNull(fields.title)) ?? quotedText(stringOrNull(fields.html));
    const thumbnailUrl = httpUrlOrNull(stringOrNull(fields.thumbnail_url));
    return { type, title, thumbnailUrl };
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** The value as an absolute http(s) URL; null for anything else (`data:`, `javascript:`, relative …). */
function httpUrlOrNull(value: string | null): string | null {
  const url = value === null ? null : parsedUrl(value.trim());
  return url && (url.protocol === "https:" || url.protocol === "http:") ? url.href : null;
}

/**
 * A title with its HTML entities decoded (WordPress sends `&#8220;` in JSON)
 * and any markup dropped; null when nothing is left.
 */
function decoded(title: string | null): string | null {
  if (title === null) return null;
  let text = "";
  const parser = new Parser({
    ontext(data) {
      text += data;
    },
  });
  parser.end(title);
  return text.trim() ? text : null;
}

/**
 * The text of the first paragraph inside a `<blockquote>` of an embed's HTML
 * (how X and Mastodon quote the post), entities decoded, whitespace collapsed;
 * null without one. Parsed as data only: nothing in it is run or fetched.
 */
function quotedText(html: string | null): string | null {
  if (!html) return null;
  let inQuote = 0;
  let inParagraph = false;
  let done = false;
  let text = "";
  const parser = new Parser({
    onopentag(name) {
      if (name === "blockquote") inQuote++;
      else if (name === "p" && inQuote > 0 && !done) inParagraph = true;
    },
    ontext(data) {
      if (inParagraph) text += data;
    },
    onclosetag(name) {
      if (name === "blockquote") inQuote--;
      else if (name === "p" && inParagraph) {
        inParagraph = false;
        done = true;
      }
    },
  });
  parser.end(html);
  return collapseWhitespace(text) || null;
}
