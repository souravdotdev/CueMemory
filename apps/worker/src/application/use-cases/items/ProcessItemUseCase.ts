import { inject, injectable } from "inversify";
import type { ProcessItemResult } from "@/application/dto/items/ProcessItemResult";
import { WORKER_TOKENS } from "@/di/tokens";
import {
  type ItemMetadata,
  type ItemRef,
  type ItemType,
  NO_METADATA,
} from "@/domain/entities/Item";
import type { PageHead } from "@/domain/entities/PageHead";
import type { IOEmbedProvider, OEmbed } from "@/domain/providers/IOEmbedProvider";
import type { FetchedPage, IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import { itemTypeFromJsonLd } from "@/domain/rules/itemTypeFromJsonLd";
import { itemTypeFromOpenGraph } from "@/domain/rules/itemTypeFromOpenGraph";
import { itemTypeFromResponse } from "@/domain/rules/itemTypeFromResponse";
import { itemTypeFromTwitterCard } from "@/domain/rules/itemTypeFromTwitterCard";
import { itemTypeFromUrl } from "@/domain/rules/itemTypeFromUrl";
import {
  itemTypeFromOEmbed,
  type KnownOEmbedProvider,
  knownOEmbedRequestFor,
  type OEmbedRequest,
  oEmbedRequestFor,
} from "@/domain/rules/oEmbed";
import {
  documentMetadata,
  openGraphMetadata,
  pickMetadata,
  twitterCardMetadata,
} from "@/domain/rules/pageMetadata";

/**
 * Runs an Item's Processing: fetches its Source URL once (guarded), asks at
 * most one oEmbed endpoint about it, and marks it Ready with the Item type and
 * the page's title and description, each decided by the precedence below.
 *
 * Every Item is fetched, even one a URL rule already types, for its title.
 * When the fetch fails or is refused, an Item a rule typed still becomes
 * Ready, titled by its known oEmbed provider if it has one (X, YouTube …);
 * an untyped one's error propagates, so the job is retried and, out of
 * attempts, the Item ends Failed as a Link. An oEmbed call that fails or is
 * refused never fails Processing: the page's other signals decide.
 */
@injectable()
export class ProcessItemUseCase {
  constructor(
    @inject(WORKER_TOKENS.ItemRepository) private readonly items: IItemRepository,
    @inject(WORKER_TOKENS.UrlFetcher) private readonly fetcher: IUrlFetcher,
    @inject(WORKER_TOKENS.OEmbedProvider) private readonly oEmbeds: IOEmbedProvider,
  ) {}

  async execute(ref: ItemRef): Promise<ProcessItemResult> {
    const item = await this.items.findById(ref);
    if (!item) return { outcome: "missing" };

    const typeFromSourceUrl = itemTypeFromUrl(item.sourceUrl);
    let page: FetchedPage;
    try {
      page = await this.fetcher.fetchPage(item.sourceUrl);
    } catch (error) {
      if (typeFromSourceUrl === null) throw error;
      // A known provider still describes a post its site wouldn't serve.
      const answer = await this.ask(knownOEmbedRequestFor(item.sourceUrl));
      return this.ready(ref, typeFromSourceUrl, metadataOf(null, answer));
    }

    const head = page.kind === "html" ? page.head : null;
    // A file says nothing oEmbed could add; an unsuccessful answer may still be a known provider's.
    const request = page.kind === "file" ? null : oEmbedRequestFor(page.finalUrl, head);
    const answer = await this.ask(request);
    return this.ready(ref, itemTypeOf(typeFromSourceUrl, page, answer), metadataOf(head, answer));
  }

  /** What the oEmbed endpoint says, or null when there is none to ask or the call fails or is refused. */
  private async ask(request: OEmbedRequest | null): Promise<OEmbedAnswer | null> {
    if (!request) return null;
    try {
      return {
        oEmbed: await this.oEmbeds.fetchOEmbed(request.endpointUrl),
        provider: request.provider,
      };
    } catch {
      return null;
    }
  }

  private async ready(
    ref: ItemRef,
    type: ItemType,
    metadata: ItemMetadata,
  ): Promise<ProcessItemResult> {
    await this.items.markReady(ref, type, metadata);
    return { outcome: "ready", type, metadata };
  }
}

/**
 * The Item type precedence, the first signal that answers wins:
 * 1. the URL rules on the Source URL as pasted, then on the final URL;
 * 2. a file's Content-Type, then its magic bytes;
 * 3. the page's declarations: oEmbed, then JSON-LD, then Open Graph, then
 *    Twitter Card (an unsuccessful answer has only oEmbed);
 * 4. Link.
 * The Source URL itself is never changed: it stays as pasted.
 */
function itemTypeOf(
  typeFromSourceUrl: ItemType | null,
  page: FetchedPage,
  answer: OEmbedAnswer | null,
): ItemType {
  const fromUrl = typeFromSourceUrl ?? itemTypeFromUrl(page.finalUrl);
  if (fromUrl) return fromUrl;
  const fromOEmbed = answer && itemTypeFromOEmbed(answer.oEmbed, answer.provider);
  switch (page.kind) {
    case "file":
      return itemTypeFromResponse(page) ?? "link";
    case "html":
      return (
        fromOEmbed ??
        itemTypeFromJsonLd(page.head) ??
        itemTypeFromOpenGraph(page.head) ??
        itemTypeFromTwitterCard(page.head) ??
        "link"
      );
    case "unsuccessful":
      return fromOEmbed ?? "link";
  }
}

/**
 * The title and description precedence, field by field: oEmbed (a title
 * only), then Open Graph, then Twitter Card, then the page's `<title>` and
 * meta description. Without an HTML head or an oEmbed answer there are none.
 */
function metadataOf(head: PageHead | null, answer: OEmbedAnswer | null): ItemMetadata {
  const sources: ItemMetadata[] = [];
  if (answer) sources.push({ title: answer.oEmbed.title, description: null });
  if (head)
    sources.push(openGraphMetadata(head), twitterCardMetadata(head), documentMetadata(head));
  return sources.length === 0 ? NO_METADATA : pickMetadata(sources);
}

/** An oEmbed answer and the known provider it came from, if any. */
interface OEmbedAnswer {
  oEmbed: OEmbed;
  provider: KnownOEmbedProvider | null;
}
