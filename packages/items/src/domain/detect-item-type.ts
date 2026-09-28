import type { ItemType } from "@second-brain/types";

export function detectItemType(url: string): ItemType {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, "");

  if (host === "x.com" || host === "twitter.com") return "tweet";
  if (host === "youtube.com" || host === "youtu.be") return "video";
  if (pathname.toLowerCase().endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(pathname)) return "image";

  return "article";
}
