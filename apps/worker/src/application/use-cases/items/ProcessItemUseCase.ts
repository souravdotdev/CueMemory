import { inject, injectable } from "inversify";
import type { ProcessItemResult } from "@/application/dto/items/ProcessItemResult";
import { WORKER_TOKENS } from "@/di/tokens";
import {
  type ItemMetadata,
  type ItemRef,
  type ItemType,
  NO_METADATA,
} from "@/domain/entities/Item";
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
 * Ready (without a title); an untyped one's error propagates, so the job is
 * retried and, out of attempts, the Item ends Failed as a Link. An oEmbed
 * call that fails or is refused never fails Processing: the page's other
 * signals decide.
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
      return this.ready(ref, typeFromSourceUrl, NO_METADATA);
    }

    const answer = await this.oEmbedAbout(page);
    return this.ready(ref, itemTypeOf(typeFromSourceUrl, page, answer), metadataOf(page, answer));
  }

  /**
   * What oEmbed says about an HTML page (or an unsuccessful answer, which a
   * known provider may still describe): null for a file, when there is no
   * endpoint to ask, or when the call fails or is refused.
   */
  private async oEmbedAbout(page: FetchedPage): Promise<OEmbedAnswer | null> {
    if (page.firstBytes !== null) return null;
    const request = oEmbedRequestFor(page.finalUrl, page.head);
    if (!request) return null;
    try {
      return { oEmbed: await this.oEmbeds.fetchOEmbed(request.endpointUrl), ...request };
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
 * 2. a non-HTML response's Content-Type, then its magic bytes;
 * 3. the page's declarations: oEmbed, then JSON-LD, then Open Graph, then
 *    Twitter Card;
 * 4. Link.
 * The Source URL itself is never changed: it stays as pasted.
 */
function itemTypeOf(
  typeFromSourceUrl: ItemType | null,
  page: FetchedPage,
  answer: OEmbedAnswer | null,
): ItemType {
  const { head } = page;
  return (
    typeFromSourceUrl ??
    itemTypeFromUrl(page.finalUrl) ??
    itemTypeFromResponse(page) ??
    (answer && itemTypeFromOEmbed(answer.oEmbed, answer.provider)) ??
    (head && itemTypeFromJsonLd(head)) ??
    (head && itemTypeFromOpenGraph(head)) ??
    (head && itemTypeFromTwitterCard(head)) ??
    "link"
  );
}

/**
 * The title and description precedence, field by field: oEmbed (a title
 * only), then Open Graph, then Twitter Card, then the page's `<title>` and
 * meta description. A page that isn't HTML has none.
 */
function metadataOf({ head }: FetchedPage, answer: OEmbedAnswer | null): ItemMetadata {
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
