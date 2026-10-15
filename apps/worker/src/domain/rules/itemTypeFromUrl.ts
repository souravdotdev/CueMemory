import type { ItemType } from "@/domain/entities/Item";
import { itemTypeFromExtension } from "@/domain/rules/itemTypeFromExtension";
import { KNOWN_SITES, type KnownSite } from "@/domain/rules/knownSites";

/** Whether a host (as `siteHost` gives it) is one of these host patterns (see `KnownSite.hosts`). */
export function hostMatches(hosts: KnownSite["hosts"], host: string): boolean {
  return hosts.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) return host.endsWith(pattern.slice(1));
    return host === pattern;
  });
}

/** A URL's host as the site tables compare it: lower-case, without a leading `www.` or `m.`. */
export function siteHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www|m)\./, "");
}

/**
 * The URL rules: works out an Item type from a URL's address alone, without
 * fetching it. The known-site table (`knownSites.ts`) is tried first, then the
 * extension ending the path. Works on any URL, the pasted Source URL or the
 * final one after redirects. Returns null when no rule recognises the URL: the
 * caller decides what an unrecognised URL becomes.
 */
export function itemTypeFromUrl(rawUrl: string): ItemType | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = siteHost(url);
  const path = url.pathname;
  const site = KNOWN_SITES.find(
    (candidate) => hostMatches(candidate.hosts, host) && (candidate.path?.test(path) ?? true),
  );
  return site?.type ?? itemTypeFromExtension(path);
}
