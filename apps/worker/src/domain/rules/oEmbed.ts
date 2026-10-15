import type { ItemType } from "@/domain/entities/Item";
import type { PageHead } from "@/domain/entities/PageHead";
import type { OEmbed } from "@/domain/providers/IOEmbedProvider";
import { hostMatches, siteHost } from "@/domain/rules/itemTypeFromUrl";

/**
 * A known oEmbed provider: pages on these hosts whose path matches are asked
 * about at its endpoint, and a `rich` answer from it is this Item type.
 * `hosts` and `path` work as in the known-site table (`knownSites.ts`).
 */
export interface KnownOEmbedProvider {
  readonly name: string;
  readonly hosts: readonly string[];
  readonly path: RegExp;
  /** The endpoint, without a query; the page URL and `format=json` are added to it. */
  readonly endpoint: string;
  /** What a `rich` answer (an embedded player or post) from this provider is. */
  readonly rich: ItemType;
}

/**
 * The oEmbed providers asked directly, chosen from the final URL, so a page
 * behind a login wall (X, Reddit, TikTok) still gets a type and a title.
 * Adding a provider is one row.
 */
export const KNOWN_OEMBED_PROVIDERS: readonly KnownOEmbedProvider[] = [
  {
    name: "YouTube",
    hosts: ["youtube.com"],
    path: /^\/(watch\/?$|shorts\/|live\/)/,
    endpoint: "https://www.youtube.com/oembed",
    rich: "video",
  },
  {
    name: "YouTube",
    hosts: ["youtu.be"],
    path: /^\/[^/]+/,
    endpoint: "https://www.youtube.com/oembed",
    rich: "video",
  },
  {
    name: "Vimeo",
    hosts: ["vimeo.com"],
    path: /^\/(\d+|channels\/[^/]+\/\d+|groups\/[^/]+\/videos\/\d+)\/?$/,
    endpoint: "https://vimeo.com/api/oembed.json",
    rich: "video",
  },
  {
    name: "X",
    hosts: ["x.com", "twitter.com"],
    path: /^\/[^/]+\/status\/\d+(\/|$)/,
    endpoint: "https://publish.twitter.com/oembed",
    rich: "post",
  },
  {
    name: "Spotify",
    hosts: ["open.spotify.com"],
    path: /^\/(intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/[^/]+/,
    endpoint: "https://open.spotify.com/oembed",
    rich: "audio",
  },
  {
    name: "SoundCloud",
    hosts: ["soundcloud.com"],
    path: /^\/[^/]+\/[^/]+/,
    endpoint: "https://soundcloud.com/oembed",
    rich: "audio",
  },
  {
    name: "Reddit",
    hosts: ["reddit.com", "old.reddit.com", "new.reddit.com", "np.reddit.com"],
    path: /^\/r\/[^/]+\/(comments|s)\/[^/]+/,
    endpoint: "https://www.reddit.com/oembed",
    rich: "post",
  },
  {
    name: "TikTok",
    hosts: ["tiktok.com"],
    path: /^\/@[^/]+\/video\/\d+/,
    endpoint: "https://www.tiktok.com/oembed",
    rich: "video",
  },
];

/** The one oEmbed call to make for a page, and the known provider it goes to (null if none). */
export interface OEmbedRequest {
  endpointUrl: string;
  provider: KnownOEmbedProvider | null;
}

/**
 * Which oEmbed endpoint to ask about a page, at most one: a known provider's
 * endpoint chosen from the final URL, else the page's first JSON discovery
 * link, used as written (the guard checks it like any other URL). Null when
 * there is neither.
 */
export function oEmbedRequestFor(finalUrl: string, head: PageHead | null): OEmbedRequest | null {
  const url = parsed(finalUrl);
  if (url) {
    const host = siteHost(url);
    const provider = KNOWN_OEMBED_PROVIDERS.find(
      (candidate) => hostMatches(candidate.hosts, host) && candidate.path.test(url.pathname),
    );
    if (provider) {
      const endpoint = new URL(provider.endpoint);
      endpoint.searchParams.set("url", finalUrl);
      endpoint.searchParams.set("format", "json");
      return { endpointUrl: endpoint.href, provider };
    }
  }

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
      return provider?.rich ?? null;
    default:
      return null;
  }
}

/** The known provider whose endpoint a discovery link points at, if any. */
function providerAt(endpointUrl: string): KnownOEmbedProvider | null {
  const url = parsed(endpointUrl);
  if (!url) return null;
  const where = siteHost(url) + url.pathname;
  return (
    KNOWN_OEMBED_PROVIDERS.find((provider) => {
      const endpoint = new URL(provider.endpoint);
      return siteHost(endpoint) + endpoint.pathname === where;
    }) ?? null
  );
}

function parsed(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}
