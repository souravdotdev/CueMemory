import type { ItemType } from "@/domain/entities/Item";
import { itemTypeFromExtension } from "@/domain/rules/itemTypeFromExtension";
import { knownSiteFor } from "@/domain/rules/knownSites";
import { parsedUrl } from "@/domain/rules/parsedUrl";

/**
 * The URL rules: works out an Item type from a URL's address alone, without
 * fetching it. The known-site table (`knownSites.ts`) is tried first, then the
 * extension ending the path. Works on any URL, the pasted Source URL or the
 * final one after redirects. Returns null when no rule recognises the URL: the
 * caller decides what an unrecognised URL becomes.
 */
export function itemTypeFromUrl(rawUrl: string): ItemType | null {
  const url = parsedUrl(rawUrl);
  if (!url) return null;
  return knownSiteFor(url)?.type ?? itemTypeFromExtension(url.pathname);
}
