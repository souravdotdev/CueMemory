import { describe, expect, it } from "vitest";
import { itemTypeFromUrl } from "@/domain/rules/itemTypeFromUrl";

describe("itemTypeFromUrl", () => {
  describe("known sites", () => {
    it.each([
      // Video
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video"],
      ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "video"],
      ["https://youtube.com/shorts/abc123", "video"],
      ["https://www.youtube.com/live/abc123", "video"],
      ["https://youtu.be/dQw4w9WgXcQ?si=xyz", "video"],
      ["https://vimeo.com/76979871", "video"],
      ["https://vimeo.com/channels/staffpicks/76979871", "video"],
      ["https://player.vimeo.com/video/76979871", "video"],
      ["https://www.tiktok.com/@someone/video/7234567890123456789", "video"],
      ["https://vm.tiktok.com/ZMabc123/", "video"],
      ["https://www.twitch.tv/videos/1234567890", "video"],
      ["https://www.twitch.tv/someone/clip/FunnyClipName", "video"],
      ["https://clips.twitch.tv/FunnyClipName", "video"],
      ["https://www.dailymotion.com/video/x8abc12", "video"],
      ["https://dai.ly/x8abc12", "video"],
      ["https://www.loom.com/share/0123456789abcdef", "video"],
      ["https://www.instagram.com/reel/C1a2b3/", "video"],
      ["https://instagram.com/reels/C1a2b3/", "video"],
      ["https://www.instagram.com/someone/reel/C1a2b3/", "video"],
      ["https://www.facebook.com/watch/?v=1234567890", "video"],
      ["https://www.facebook.com/somepage/videos/1234567890/", "video"],
      ["https://fb.watch/abcDEF123/", "video"],
      // Audio
      ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "audio"],
      ["https://open.spotify.com/intl-de/album/4aawyAB9vmqN3uQ7FjRGTy", "audio"],
      ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "audio"],
      ["https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ", "audio"],
      ["https://open.spotify.com/show/2mTUnDkuKUkhiueKcVWoP0", "audio"],
      ["https://soundcloud.com/someartist/some-track", "audio"],
      ["https://soundcloud.com/someartist/sets/some-playlist", "audio"],
      ["https://on.soundcloud.com/AbC12", "audio"],
      ["https://podcasts.apple.com/us/podcast/some-show/id1234567890", "audio"],
      ["https://music.apple.com/us/album/some-album/1234567890", "audio"],
      ["https://someartist.bandcamp.com/track/some-track", "audio"],
      ["https://someartist.bandcamp.com/album/some-album", "audio"],
      // Post
      ["https://x.com/jack/status/20", "post"],
      ["https://twitter.com/jack/status/20", "post"],
      ["https://www.twitter.com/jack/status/20?s=20", "post"],
      ["https://m.twitter.com/jack/status/20", "post"],
      ["https://x.com/jack/status/20/photo/1", "post"],
      ["https://www.threads.net/@zuck/post/C1a2b3", "post"],
      ["https://www.threads.com/@zuck/post/C1a2b3", "post"],
      ["https://bsky.app/profile/someone.bsky.social/post/3kabc123", "post"],
      ["https://mastodon.social/@Gargron/109318821117356215", "post"],
      ["https://fosstodon.org/@someone/111222333444555666", "post"],
      ["https://mastodon.social/users/Gargron/statuses/109318821117356215", "post"],
      ["https://www.linkedin.com/posts/someone_some-title-activity-7123456789-abcd", "post"],
      ["https://www.linkedin.com/feed/update/urn:li:activity:7123456789/", "post"],
      ["https://www.facebook.com/somepage/posts/pfbid0abc", "post"],
      ["https://www.facebook.com/permalink.php?story_fbid=1&id=2", "post"],
      ["https://www.facebook.com/groups/somegroup/posts/1234567890/", "post"],
      ["https://www.facebook.com/share/p/AbC123/", "post"],
      ["https://www.reddit.com/r/typescript/comments/abc123/some_title/", "post"],
      ["https://m.reddit.com/r/typescript/comments/abc123", "post"],
      ["https://old.reddit.com/r/typescript/comments/abc123/some_title/", "post"],
      ["https://www.reddit.com/r/typescript/s/AbC123", "post"],
      ["https://redd.it/abc123", "post"],
      ["https://www.instagram.com/p/C1a2b3/?igsh=abc", "post"],
      ["https://www.instagram.com/someone/p/C1a2b3/", "post"],
      ["https://github.com/vercel/next.js/issues/123", "post"],
      ["https://github.com/vercel/next.js/pull/456/files", "post"],
      ["https://github.com/vercel/next.js/discussions/789", "post"],
      [
        "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster",
        "post",
      ],
      ["https://stackoverflow.com/q/11227809", "post"],
      ["https://unix.stackexchange.com/questions/12345/some-title", "post"],
      // Code
      ["https://github.com/vercel/next.js", "code"],
      ["https://github.com/vercel/next.js/", "code"],
      ["https://github.com/vercel/next.js/tree/canary/packages", "code"],
      ["https://github.com/vercel/next.js/blob/canary/package.json", "code"],
      ["https://gist.github.com/someone/0123456789abcdef0123456789abcdef", "code"],
      ["https://gist.github.com/0123456789abcdef0123", "code"],
      ["https://gitlab.com/gitlab-org/gitlab", "code"],
      ["https://gitlab.com/gitlab-org/gitlab/-/tree/master/app", "code"],
      ["https://gitlab.com/gitlab-org/sub/project/-/blob/main/README.md", "code"],
      ["https://bitbucket.org/atlassian/python-bitbucket", "code"],
      ["https://bitbucket.org/atlassian/python-bitbucket/src/master/README.md", "code"],
      ["https://codepen.io/someone/pen/abcXYZ", "code"],
      ["https://codesandbox.io/s/new-abc123", "code"],
      ["https://codesandbox.io/p/sandbox/some-name-abc123", "code"],
      ["https://replit.com/@someone/SomeRepl", "code"],
      ["https://www.npmjs.com/package/zod", "code"],
      ["https://www.npmjs.com/package/@tanstack/react-query", "code"],
      ["https://pypi.org/project/requests/", "code"],
      // Article
      ["https://medium.com/@someone/some-title-1a2b3c4d5e6f", "article"],
      ["https://medium.com/some-publication/some-title-1a2b3c4d5e6f", "article"],
      ["https://someone.medium.com/some-title-1a2b3c4d5e6f", "article"],
      ["https://medium.com/p/1a2b3c4d5e6f", "article"],
      ["https://someone.substack.com/p/some-title", "article"],
      ["https://substack.com/@someone/p/some-title", "article"],
      ["https://substack.com/home/post/p-123456", "article"],
      ["https://dev.to/someone/some-title-4k2l", "article"],
      ["https://someone.hashnode.dev/some-title", "article"],
      ["https://hashnode.com/post/some-title-ckabc123", "article"],
      ["https://arxiv.org/abs/1706.03762", "article"],
      ["https://arxiv.org/abs/1706.03762v7", "article"],
      ["https://en.wikipedia.org/wiki/Penguin", "article"],
      ["https://en.m.wikipedia.org/wiki/Penguin", "article"],
      ["https://de.wikipedia.org/wiki/Pinguine", "article"],
      ["https://en.wikipedia.org/wiki/Star_Wars:_A_New_Hope", "article"],
      // PDF
      ["https://arxiv.org/pdf/1706.03762", "pdf"],
      ["https://arxiv.org/pdf/1706.03762v7", "pdf"],
      // Image
      ["https://imgur.com/gallery/AbC12", "image"],
      ["https://imgur.com/a/AbC12", "image"],
      ["https://imgur.com/AbC12xY", "image"],
      ["https://www.flickr.com/photos/someone/53123456789/", "image"],
      ["https://flic.kr/p/2abcDEF", "image"],
      ["https://unsplash.com/photos/a-mountain-lake-AbC12xYz", "image"],
    ] as const)("%s → %s", (url, type) => {
      expect(itemTypeFromUrl(url)).toBe(type);
    });

    it.each([
      // Profiles, homepages and listings on known hosts are not one item
      "https://x.com/jack",
      "https://www.twitter.com/jack/likes",
      "https://x.com/search?q=status",
      "https://www.youtube.com/@channel",
      "https://www.youtube.com/watchlater",
      "https://youtu.be/",
      "https://vimeo.com/someone",
      "https://www.tiktok.com/@someone",
      "https://www.twitch.tv/someone",
      "https://www.dailymotion.com/someone",
      "https://www.loom.com/",
      "https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF",
      "https://open.spotify.com/",
      "https://soundcloud.com/someartist",
      "https://soundcloud.com/someartist/tracks",
      "https://soundcloud.com/discover",
      "https://bandcamp.com/",
      "https://someartist.bandcamp.com/",
      "https://www.threads.net/@zuck",
      "https://bsky.app/profile/someone.bsky.social",
      "https://mastodon.social/@Gargron",
      "https://www.linkedin.com/in/someone/",
      "https://www.linkedin.com/company/anthropic/",
      "https://www.facebook.com/somepage",
      "https://www.reddit.com/r/typescript/",
      "https://www.instagram.com/someone/",
      "https://github.com/vercel",
      "https://github.com/",
      "https://github.com/vercel/next.js/issues",
      "https://github.com/orgs/vercel/repositories",
      "https://github.com/topics/typescript",
      "https://github.com/settings/profile",
      "https://github.com/marketplace/actions",
      "https://gist.github.com/someone",
      "https://gitlab.com/gitlab-org",
      "https://gitlab.com/explore/projects",
      "https://gitlab.com/users/sign_in",
      "https://bitbucket.org/atlassian",
      "https://bitbucket.org/product/pricing",
      "https://codepen.io/someone",
      "https://replit.com/@someone",
      "https://www.npmjs.com/",
      "https://www.npmjs.com/~someone",
      "https://pypi.org/",
      "https://stackoverflow.com/questions",
      "https://stackoverflow.com/users/22656/jon-skeet",
      "https://medium.com/@someone",
      "https://medium.com/",
      "https://someone.substack.com/",
      "https://dev.to/someone",
      "https://dev.to/t/typescript",
      "https://someone.hashnode.dev/",
      "https://imgur.com/upload",
      "https://www.flickr.com/photos/someone/",
      "https://unsplash.com/",
      "https://arxiv.org/",
      "https://arxiv.org/list/cs.LG/recent",
      "https://en.wikipedia.org/",
      "https://en.wikipedia.org/wiki/Main_Page",
      "https://en.wikipedia.org/wiki/Special:Random",
      "https://en.wikipedia.org/wiki/Category:Penguins",
      "https://en.wikipedia.org/wiki/Talk:Penguin",
      "https://en.wikipedia.org/wiki/User:Someone",
      "https://en.wikipedia.org/w/index.php?title=Penguin&action=history",
      // Anything else
      "https://example.com/blog/a-post",
      "https://news.ycombinator.com/item?id=1",
    ])("%s → no rule", (url) => {
      expect(itemTypeFromUrl(url)).toBeNull();
    });
  });

  describe("file extensions", () => {
    it.each([
      ["https://arxiv.org/pdf/1706.03762v7.pdf", "pdf"],
      ["https://example.com/papers/Report.PDF", "pdf"],
      ["https://example.com/paper.pdf?download=1#page=2", "pdf"],
      ...["png", "jpg", "JPEG", "gif", "webp", "Svg", "avif"].map(
        (ext) => [`https://example.com/a.${ext}`, "image"] as const,
      ),
      ["https://example.com/a.avif?w=200", "image"],
      ...["mp3", "wav", "M4A", "ogg", "flac"].map(
        (ext) => [`https://example.com/a.${ext}`, "audio"] as const,
      ),
      ...["mp4", "MOV", "webm", "mkv"].map(
        (ext) => [`https://example.com/a.${ext}`, "video"] as const,
      ),
      ...["zip", "docx", "xlsx", "pptx", "DMG", "tar.gz", "7z", "rar", "exe", "apk", "epub"].map(
        (ext) => [`https://example.com/download/a.${ext}`, "file"] as const,
      ),
    ] as const)("%s → %s", (url, type) => {
      expect(itemTypeFromUrl(url)).toBe(type);
    });

    it.each([
      // The extension has to end the path, not sit in the query or mid-path
      "https://example.com/view?file=report.pdf",
      "https://example.com/report.pdf/preview",
      "https://example.com/logo.pngx",
      "https://example.com/archive.zip/",
      "https://example.com/index.html",
    ])("%s → no rule", (url) => {
      expect(itemTypeFromUrl(url)).toBeNull();
    });
  });

  it("compares hosts without their case", () => {
    expect(itemTypeFromUrl("https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ")).toBe("video");
  });

  it("applies the first matching row: a known site wins over an extension", () => {
    expect(itemTypeFromUrl("https://youtube.com/shorts/clip.png")).toBe("video");
    expect(itemTypeFromUrl("https://github.com/o/r/blob/main/logo.png")).toBe("code");
  });

  it("applies the first matching row: a GitHub issue is a Post, not Code", () => {
    expect(itemTypeFromUrl("https://github.com/o/r/issues/1")).toBe("post");
  });

  describe("the any-host Mastodon row", () => {
    it.each([
      // A named site's own /@user/<digits> paths are that site's, never a Mastodon post
      ["https://replit.com/@someone/123", "code"],
      ["https://www.youtube.com/@channel/123", null],
      ["https://www.tiktok.com/@someone/123", null],
      ["https://medium.com/@someone/123", null],
      ["https://www.threads.net/@zuck/123", null],
      ["https://someone.substack.com/@someone/123", null],
      // Any other host is taken for a Mastodon instance
      ["https://mastodon.social/@Gargron/109318821117356215", "post"],
      ["https://hachyderm.io/users/someone/statuses/111", "post"],
    ] as const)("%s → %s", (url, type) => {
      expect(itemTypeFromUrl(url)).toBe(type);
    });
  });

  it("matches no rule for a string that isn't a URL", () => {
    expect(itemTypeFromUrl("not a url")).toBeNull();
  });
});
