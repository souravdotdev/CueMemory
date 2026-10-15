import type { ItemType } from "@/domain/entities/Item";

/**
 * One row of the known-site table: links on these hosts whose path matches
 * are this Item type.
 *
 * - `hosts`: lower-case, without `www.` or `m.`. `*.example.com` matches any
 *   subdomain of example.com (not example.com itself); `*` matches any host.
 * - `path`: tested against the URL's path only, never its query or fragment.
 *   Left out, every path on the host matches.
 */
export interface KnownSite {
  readonly hosts: readonly string[];
  readonly path?: RegExp;
  readonly type: ItemType;
}

// First-segment GitHub paths that are not a user or organisation.
const GITHUB_RESERVED =
  "about|account|apps|codespaces|collections|customer-stories|enterprise|events|explore|features|login|marketplace|new|notifications|orgs|organizations|pricing|readme|resources|search|security|settings|site|solutions|sponsors|team|topics|trending|users";
const GITLAB_RESERVED = "dashboard|explore|groups|help|projects|search|users";
const BITBUCKET_RESERVED = "account|blog|dashboard|product|repo|site|workspace";

/**
 * The popular sites recognised from their address alone. In order: the first
 * matching row wins, so a more specific row (a GitHub issue) sits above a
 * broader one on the same host (a GitHub repository). Profiles, homepages and
 * listings match no row on purpose. Adding a site is one row.
 */
export const KNOWN_SITES: readonly KnownSite[] = [
  // Video
  { hosts: ["youtube.com"], path: /^\/(watch\/?$|shorts\/|live\/)/, type: "video" },
  { hosts: ["youtu.be"], path: /^\/[^/]+/, type: "video" },
  {
    hosts: ["vimeo.com"],
    path: /^\/(\d+|channels\/[^/]+\/\d+|groups\/[^/]+\/videos\/\d+)\/?$/,
    type: "video",
  },
  { hosts: ["player.vimeo.com"], path: /^\/video\/\d+/, type: "video" },
  { hosts: ["tiktok.com"], path: /^\/@[^/]+\/video\/\d+/, type: "video" },
  { hosts: ["vm.tiktok.com", "vt.tiktok.com"], path: /^\/[^/]+/, type: "video" },
  { hosts: ["twitch.tv"], path: /^\/(videos\/\d+|[^/]+\/clip\/[^/]+)/, type: "video" },
  { hosts: ["clips.twitch.tv"], path: /^\/[^/]+/, type: "video" },
  { hosts: ["dailymotion.com"], path: /^\/video\/[^/]+/, type: "video" },
  { hosts: ["dai.ly"], path: /^\/[^/]+/, type: "video" },
  { hosts: ["loom.com"], path: /^\/(share|embed)\/[^/]+/, type: "video" },
  { hosts: ["instagram.com"], path: /^\/([^/]+\/)?reels?\/[^/]+/, type: "video" },
  { hosts: ["facebook.com"], path: /^\/(watch\/?$|[^/]+\/videos\/)/, type: "video" },
  { hosts: ["fb.watch"], path: /^\/[^/]+/, type: "video" },

  // Audio
  {
    hosts: ["open.spotify.com"],
    path: /^\/(intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/[^/]+/,
    type: "audio",
  },
  {
    hosts: ["soundcloud.com"],
    path: /^\/(?!discover\/?$|search|stream|upload|you\/)[^/]+\/(sets\/[^/]+|(?!(tracks|albums|sets|reposts|likes|followers|following|popular-tracks|comments)\/?$)[^/]+)\/?$/,
    type: "audio",
  },
  { hosts: ["on.soundcloud.com"], path: /^\/[^/]+/, type: "audio" },
  { hosts: ["podcasts.apple.com"], path: /^\/([a-z]{2}\/)?podcast\//, type: "audio" },
  { hosts: ["music.apple.com"], path: /^\/([a-z]{2}\/)?(album|playlist|song)\//, type: "audio" },
  { hosts: ["*.bandcamp.com"], path: /^\/(track|album)\/[^/]+/, type: "audio" },

  // Post
  { hosts: ["x.com", "twitter.com"], path: /^\/[^/]+\/status\/\d+(\/|$)/, type: "post" },
  { hosts: ["threads.net", "threads.com"], path: /^\/@[^/]+\/post\/[^/]+/, type: "post" },
  { hosts: ["bsky.app"], path: /^\/profile\/[^/]+\/post\/[^/]+/, type: "post" },
  { hosts: ["linkedin.com"], path: /^\/(posts|feed\/update)\/[^/]+/, type: "post" },
  {
    hosts: ["facebook.com"],
    path: /^\/([^/]+\/posts\/|groups\/[^/]+\/(posts|permalink)\/|permalink\.php|story\.php|share\/p\/)/,
    type: "post",
  },
  {
    hosts: ["reddit.com", "old.reddit.com", "new.reddit.com", "np.reddit.com"],
    path: /^\/r\/[^/]+\/(comments|s)\/[^/]+/,
    type: "post",
  },
  { hosts: ["redd.it"], path: /^\/[^/]+/, type: "post" },
  { hosts: ["instagram.com"], path: /^\/([^/]+\/)?p\/[^/]+/, type: "post" },
  {
    hosts: ["github.com"],
    path: /^\/[^/]+\/[^/]+\/(issues|pull|discussions)\/\d+/,
    type: "post",
  },
  {
    hosts: [
      "stackoverflow.com",
      "superuser.com",
      "serverfault.com",
      "askubuntu.com",
      "mathoverflow.net",
      "*.stackexchange.com",
    ],
    path: /^\/(questions|q|a)\/\d+/,
    type: "post",
  },
  // Mastodon, on any instance: /@<user>/<id> or /users/<user>/statuses/<id>
  { hosts: ["*"], path: /^\/(@[^/]+|users\/[^/]+\/statuses)\/\d+\/?$/, type: "post" },

  // Code
  {
    hosts: ["github.com"],
    path: new RegExp(`^/(?!(${GITHUB_RESERVED})/)[^/]+/[^/]+(/(tree|blob)/.+)?/?$`),
    type: "code",
  },
  {
    hosts: ["gist.github.com"],
    path: /^\/([^/]+\/)?[0-9a-f]{20,}\/?$/,
    type: "code",
  },
  {
    hosts: ["gitlab.com"],
    // group(/subgroup…)/project, optionally /-/tree/… or /-/blob/…
    path: new RegExp(`^/(?!(${GITLAB_RESERVED})/)[^/-][^/]*(/[^/-][^/]*)+(/-/(tree|blob)/.+)?/?$`),
    type: "code",
  },
  {
    hosts: ["bitbucket.org"],
    path: new RegExp(`^/(?!(${BITBUCKET_RESERVED})/)[^/]+/[^/]+(/src/.*)?/?$`),
    type: "code",
  },
  { hosts: ["codepen.io"], path: /^\/[^/]+\/(pen|full|details)\/[^/]+/, type: "code" },
  {
    hosts: ["codesandbox.io"],
    path: /^\/(s|embed|p\/sandbox|p\/devbox|p\/github)\/[^/]+/,
    type: "code",
  },
  { hosts: ["replit.com"], path: /^\/@[^/]+\/[^/]+/, type: "code" },
  { hosts: ["npmjs.com"], path: /^\/package\/[^/]+/, type: "code" },
  { hosts: ["pypi.org"], path: /^\/project\/[^/]+/, type: "code" },

  // Article
  {
    hosts: ["medium.com"],
    path: /^\/([^/]+\/[^/]+-[0-9a-f]{8,}|p\/[0-9a-f]{8,})\/?$/,
    type: "article",
  },
  { hosts: ["*.medium.com"], path: /^\/[^/]+-[0-9a-f]{8,}\/?$/, type: "article" },
  { hosts: ["*.substack.com"], path: /^\/p\/[^/]+/, type: "article" },
  { hosts: ["substack.com"], path: /^\/(@[^/]+\/p|home\/post)\/[^/]+/, type: "article" },
  {
    hosts: ["dev.to"],
    path: /^\/(?!(t|search|settings|tags|top|latest|videos|listings|enter)\/)[^/]+\/[^/]+\/?$/,
    type: "article",
  },
  { hosts: ["*.hashnode.dev"], path: /^\/[^/]+\/?$/, type: "article" },
  { hosts: ["hashnode.com"], path: /^\/post\/[^/]+/, type: "article" },
  { hosts: ["linkedin.com"], path: /^\/pulse\/[^/]+/, type: "article" },

  // Image
  {
    hosts: ["imgur.com"],
    path: /^\/((gallery|a)\/[^/]+|(?!(upload|signin|register|search|privacy|rules|emerald)\/?$)[A-Za-z0-9]{5,8}\/?$)/,
    type: "image",
  },
  { hosts: ["flickr.com"], path: /^\/photos\/[^/]+\/\d+/, type: "image" },
  { hosts: ["flic.kr"], path: /^\/p\/[^/]+/, type: "image" },
  { hosts: ["unsplash.com"], path: /^\/photos\/[^/]+/, type: "image" },
];
