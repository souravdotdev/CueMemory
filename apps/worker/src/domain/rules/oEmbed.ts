import type { ItemType } from "@/domain/entities/Item";
import type { PageHead } from "@/domain/entities/PageHead";
import type { OEmbed } from "@/domain/providers/IOEmbedProvider";
import {
  KNOWN_SITES,
  type KnownSite,
  knownSiteFor,
  type OEmbedEndpoint,
  siteHost,
} from "@/domain/rules/knownSites";
import { parsedUrl } from "@/domain/rules/parsedUrl";

/**
 * A known oEmbed provider: a known-site row (`knownSites.ts`) with an oEmbed
 * endpoint. Its links are asked about at that endpoint directly, so a page
 * behind a login wall (X, Reddit, TikTok) still gets a type and a title, and
 * a `rich` answer from it is the row's Item type.
 */
export type KnownOEmbedProvider = KnownSite & { readonly oEmbed: OEmbedEndpoint };

/** The one oEmbed call to make for a page, and the known provider it goes to (null if none). */
export interface OEmbedRequest {
  endpointUrl: string;
  provider: KnownOEmbedProvider | null;
}

function isProvider(site: KnownSite | null): site is KnownOEmbedProvider {
  return site?.oEmbed !== undefined;
}

/**
 * The known provider's endpoint to ask about a page URL, with
 * `?url=<page URL>&format=json`; null when the URL's known-site row has no
 * endpoint (or it matches no row). Needs no fetch of the page.
 */
export function knownOEmbedRequestFor(pageUrl: string): OEmbedRequest | null {
  const url = parsedUrl(pageUrl);
  const site = url && knownSiteFor(url);
  if (!isProvider(site)) return null;
  const endpoint = new URL(site.oEmbed.endpoint);
  endpoint.searchParams.set("url", pageUrl);
  endpoint.searchParams.set("format", "json");
  return { endpointUrl: endpoint.href, provider: site };
}

/**
 * Which oEmbed endpoint to ask about a page, at most one: a known provider's
 * endpoint chosen from the final URL, else the page's first JSON discovery
 * link, used as written (the guard checks it like any other URL). Null when
 * there is neither.
 */
export function oEmbedRequestFor(finalUrl: string, head: PageHead | null): OEmbedRequest | null {
  const known = knownOEmbedRequestFor(finalUrl);
  if (known) return known;
  const link = head?.oEmbedLinks.find(({ format }) => format === "json");
  if (!link) return null;
  return { endpointUrl: link.url, provider: providerAt(link.url) };
}

/**
 * Works out an Item type from an oEmbed answer: `video` is a Video, `photo` an
 * Image, `rich` whatever the known provider's embeds are (nothing for an
 * unknown one), `link` and anything else nothing.
 */
export function itemTypeFromOEmbed(
  oEmbed: OEmbed,
  provider: KnownOEmbedProvider | null,
): ItemType | null {
  switch (oEmbed.type?.trim().toLowerCase()) {
    case "video":
      return "video";
    case "photo":
      return "image";
    case "rich":
      return provider?.type ?? null;
    default:
      return null;
  }
}

/** The known provider whose endpoint a discovery link points at, if any. */
function providerAt(endpointUrl: string): KnownOEmbedProvider | null {
  const url = parsedUrl(endpointUrl);
  if (!url) return null;
  const where = siteHost(url) + url.pathname;
  const atEndpoint = (site: KnownSite) => {
    if (!site.oEmbed) return false;
    const endpoint = new URL(site.oEmbed.endpoint);
    return siteHost(endpoint) + endpoint.pathname === where;
  };
  return KNOWN_SITES.filter(isProvider).find(atEndpoint) ?? null;
}
