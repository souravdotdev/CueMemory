import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GuardedOEmbedProvider } from "@/infrastructure/http/GuardedOEmbedProvider";
import { isPublicAddress } from "@/infrastructure/http/publicAddress";
import {
  type ResolvedAddress,
  SafeUrlFetcher,
  UrlRefusedError,
  USER_AGENT,
} from "@/infrastructure/http/SafeUrlFetcher";

const ARTICLE_HEAD =
  '<html><head><title>An &amp; article</title><meta property="og:type" content="article">' +
  '<link rel="alternate" type="application/json+oembed" href="oembed.json"></head>';
const PNG_START = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

// A local test server. It listens on loopback, which the real guard refuses,
// so the fetchers under test treat 127.0.0.1 (and only it) as public too.
let server: Server;
let port: number;
let hits: string[];
let lastHeaders: IncomingHttpHeaders;
const openResponses = new Set<ServerResponse>();

function route(path: string, res: ServerResponse) {
  const redirect = (location: string) => res.writeHead(302, { location }).end();
  const chain = /^\/chain\/(\d+)$/.exec(path);
  if (chain) {
    const left = Number(chain[1]);
    return left === 0 ? redirect("/article") : redirect(`/chain/${left - 1}`);
  }
  const titleAfter = /^\/title-after\/(\d+)$/.exec(path);
  if (titleAfter) {
    // A head whose <title> comes only after this many KiB of padding.
    const padding = " ".repeat(Number(titleAfter[1]) * 1024);
    return res
      .writeHead(200, { "content-type": "text/html" })
      .end(`<html><head>${padding}<title>Late</title></head><body></body></html>`);
  }
  const json = (body: string, contentType = "application/json; charset=utf-8") =>
    res.writeHead(200, { "content-type": contentType }).end(body);
  switch (path) {
    case "/oembed.json":
      return json('{"version":"1.0","type":"video","title":"A video","html":"<iframe></iframe>"}');
    case "/oembed-post":
      // X's shape: no title, the post's text quoted in the embed's HTML.
      return json(
        JSON.stringify({
          type: "rich",
          author_name: "Someone",
          html:
            '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Hello &amp;  welcome ' +
            '<a href="https://t.co/x">pic.twitter.com/x</a></p>&mdash; Someone (@someone) ' +
            '<a href="https://x.com/someone/status/1">October 1, 2026</a></blockquote>' +
            '<script async src="https://platform.twitter.com/widgets.js"></script>',
        }),
      );
    case "/oembed-encoded":
      // WordPress encodes entities in its JSON titles.
      return json('{"type":"rich","title":"WordPress 6.7 &#8220;Rollins&#8221; &amp; more"}');
    case "/oembed-plus-json":
      return json('{"type":"photo","title":7}', "application/json+oembed");
    case "/oembed-html":
      return json('{"type":"video","title":"Sneaky"}', "text/html");
    case "/oembed-big":
      return json(`{"type":"video","title":"${"x".repeat(70 * 1024)}"}`);
    case "/oembed-endless": {
      openResponses.add(res);
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"type":"video","title":"');
      const chunk = "x".repeat(64 * 1024);
      const pump = () => {
        while (!res.destroyed && res.write(chunk));
        if (!res.destroyed) res.once("drain", pump);
      };
      pump();
      return;
    }
    case "/oembed-not-json":
      return json("{not json");
    case "/oembed-array":
      return json("[1, 2]");
    case "/oembed-missing":
      return res.writeHead(404, { "content-type": "application/json" }).end("{}");
    case "/to-oembed":
      return redirect("/oembed.json");
    case "/article":
      return res
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end(ARTICLE_HEAD + "<body>…</body></html>");
    case "/pdf":
      return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.7");
    case "/to-article":
      return redirect("/article");
    case "/short":
      // A short link: two hops, the second to an absolute URL.
      return redirect("/short-2");
    case "/short-2":
      return redirect(`http://site.test:${port}/pdf`);
    case "/download":
      return res
        .writeHead(200, { "content-type": "application/octet-stream" })
        .end(Buffer.concat([PNG_START, Buffer.alloc(64 * 1024)]));
    case "/untyped":
      // Node sends no Content-Type unless told to.
      return res.writeHead(200).end("%PDF-1.4");
    case "/endless-binary": {
      // A download that never ends, streamed until the client hangs up.
      openResponses.add(res);
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.write(Buffer.from([0x1a, 0x45]));
      const chunk = Buffer.alloc(64 * 1024, 0xdf);
      const pump = () => {
        while (!res.destroyed && res.write(chunk));
        if (!res.destroyed) res.once("drain", pump);
      };
      setTimeout(pump, 20);
      return;
    }
    case "/to-private":
      return redirect("http://10.0.0.1/admin");
    case "/to-metadata":
      return redirect("http://169.254.169.254/latest/meta-data/");
    case "/to-loopback-name":
      return redirect("http://loopback.test/");
    case "/to-file":
      return redirect("file:///etc/passwd");
    case "/endless": {
      // An HTML head that never ends, streamed until the client hangs up.
      openResponses.add(res);
      res.writeHead(200, { "content-type": "text/html" });
      res.write("<html><head><title>Endless</title>");
      const chunk = "<!-- padding -->".repeat(4096);
      const pump = () => {
        while (!res.destroyed && res.write(chunk));
        if (!res.destroyed) res.once("drain", pump);
      };
      pump();
      return;
    }
    case "/hang":
      openResponses.add(res);
      return; // never answers
    case "/hang-body":
      openResponses.add(res);
      res.writeHead(200, { "content-type": "text/html" });
      res.write("<html><head>");
      return; // never finishes the body
    case "/gone":
      return res.writeHead(404, { "content-type": "text/html" }).end(ARTICLE_HEAD);
    case "/broken":
      return res.writeHead(503).end();
    default:
      return res.writeHead(500).end();
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? "");
    lastHeaders = req.headers;
    // Routes by path only: oEmbed requests carry a query.
    route(new URL(req.url ?? "/", "http://site.test").pathname, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const res of openResponses) res.destroy();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  hits = [];
});

// Test DNS: names under .test, nothing from the real resolver.
const TEST_DNS: Record<string, ResolvedAddress[]> = {
  "site.test": [{ address: "127.0.0.1", family: 4 }],
  "internal.test": [{ address: "10.0.0.5", family: 4 }],
  "loopback.test": [{ address: "::1", family: 6 }],
  // One public answer and one private: every address is checked.
  "mixed.test": [
    { address: "93.184.216.34", family: 4 },
    { address: "192.168.0.10", family: 4 },
  ],
};
async function testResolve(hostname: string): Promise<ResolvedAddress[]> {
  const addresses = TEST_DNS[hostname];
  if (!addresses)
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
  return addresses;
}

function localFetcher(options: { timeoutMs?: number; maxBytes?: number } = {}) {
  return new SafeUrlFetcher({
    resolve: testResolve,
    isAllowedAddress: (address) => address === "127.0.0.1" || isPublicAddress(address),
    ...options,
  });
}

const at = (path: string, host = "site.test") => `http://${host}:${port}${path}`;

// ARTICLE_HEAD's tags, parsed once by the fetcher (its oEmbed link resolved
// against the page it was read from, after any redirects).
const ARTICLE_TAGS = () => ({
  meta: [{ key: "og:type", content: "article" }],
  title: "An & article",
  jsonLd: [],
  oEmbedLinks: [{ url: at("/oembed.json"), format: "json" }],
});

describe("SafeUrlFetcher, allowed fetches", () => {
  it("fetches an HTML page's head and sends the CueMemory User-Agent", async () => {
    const page = await localFetcher().fetchPage(at("/article"));

    expect(page).toEqual({
      finalUrl: at("/article"),
      contentType: "text/html; charset=utf-8",
      head: ARTICLE_TAGS(),
      firstBytes: null,
    });
    expect(lastHeaders["user-agent"]).toBe(USER_AGENT);
  });

  it("connects only to the checked address (site.test isn't in the real DNS)", async () => {
    await expect(localFetcher().fetchPage(at("/pdf"))).resolves.toEqual({
      finalUrl: at("/pdf"),
      contentType: "application/pdf",
      head: null,
      firstBytes: new Uint8Array(Buffer.from("%PDF-1.7")),
    });
    expect(hits).toEqual(["/pdf"]);
  });

  it("follows a redirect", async () => {
    const page = await localFetcher().fetchPage(at("/to-article"));

    expect(page.head).toEqual(ARTICLE_TAGS());
    expect(page.finalUrl).toBe(at("/article"));
    expect(hits).toEqual(["/to-article", "/article"]);
  });

  it("reports the final URL after a chain of redirects", async () => {
    const page = await localFetcher().fetchPage(at("/short"));

    expect(page.finalUrl).toBe(at("/pdf"));
    expect(page.contentType).toBe("application/pdf");
    expect(hits).toEqual(["/short", "/short-2", "/pdf"]);
  });

  it("reads only the first 16 bytes of a download", async () => {
    const page = await localFetcher().fetchPage(at("/download"));

    expect(page).toEqual({
      finalUrl: at("/download"),
      contentType: "application/octet-stream",
      head: null,
      firstBytes: new Uint8Array(PNG_START),
    });
  });

  it("reads the first bytes of a response without a Content-Type", async () => {
    const page = await localFetcher().fetchPage(at("/untyped"));

    expect(page.contentType).toBeNull();
    expect(page.firstBytes).toEqual(new Uint8Array(Buffer.from("%PDF-1.4")));
  });

  it("stops after the first bytes of a download that never ends", async () => {
    const page = await localFetcher({ timeoutMs: 2000 }).fetchPage(at("/endless-binary"));

    expect(page.firstBytes).toHaveLength(16);
    expect(Array.from(page.firstBytes!.subarray(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xdf]);
  });

  it("follows up to 5 redirects", async () => {
    const page = await localFetcher().fetchPage(at("/chain/4"));

    expect(page.head).toEqual(ARTICLE_TAGS());
    expect(hits).toHaveLength(6);
  });

  it("refuses a sixth redirect", async () => {
    await expect(localFetcher().fetchPage(at("/chain/5"))).rejects.toThrow(UrlRefusedError);
    expect(hits).toHaveLength(6);
  });

  it("stops reading after the size cap", async () => {
    const fetcher = localFetcher({ maxBytes: 64 * 1024 });

    expect((await fetcher.fetchPage(at("/title-after/60"))).head?.title).toBe("Late");
    expect((await fetcher.fetchPage(at("/title-after/70"))).head).toEqual({
      meta: [],
      title: null,
      jsonLd: [],
      oEmbedLinks: [],
    });
  });

  it("stops reading the default ~1 MB in", async () => {
    expect((await localFetcher().fetchPage(at("/title-after/1000"))).head?.title).toBe("Late");
    expect((await localFetcher().fetchPage(at("/title-after/1030"))).head?.title).toBeNull();
  });

  it("reads what a head that never ends declared before the cap", async () => {
    const page = await localFetcher({ maxBytes: 64 * 1024 }).fetchPage(at("/endless"));

    expect(page.head?.title).toBe("Endless");
  });

  it("times out when the server never answers", async () => {
    await expect(localFetcher({ timeoutMs: 200 }).fetchPage(at("/hang"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });

  it("times out when the body never finishes", async () => {
    await expect(localFetcher({ timeoutMs: 200 }).fetchPage(at("/hang-body"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });

  it("says nothing about a page that isn't there", async () => {
    await expect(localFetcher().fetchPage(at("/gone"))).resolves.toEqual({
      finalUrl: at("/gone"),
      contentType: null,
      head: null,
      firstBytes: null,
    });
  });

  it("fails on a server error, so the job retries", async () => {
    await expect(localFetcher().fetchPage(at("/broken"))).rejects.toThrow(/answered 503/);
  });
});

describe("SafeUrlFetcher, refusals", () => {
  it.each([
    ["http://127.0.0.1:PORT/article", "loopback"],
    ["http://localhost:PORT/article", "loopback by name"],
    ["http://[::1]:PORT/article", "IPv6 loopback"],
    ["http://[::ffff:127.0.0.1]:PORT/article", "IPv4-mapped loopback"],
    ["http://2130706433:PORT/article", "loopback as a number"],
    ["http://0.0.0.0:PORT/article", "unspecified"],
    ["http://10.0.0.1/", "private"],
    ["http://172.16.0.1/", "private"],
    ["http://192.168.1.1/", "private"],
    ["http://169.254.169.254/latest/meta-data/", "the metadata service"],
    ["http://[fe80::1]/", "IPv6 link-local"],
    ["http://[fd00::1]/", "IPv6 unique local"],
    ["http://[::]/", "IPv6 unspecified"],
  ])("refuses %s (%s) with the real guard, never connecting", async (url) => {
    const fetcher = new SafeUrlFetcher();

    await expect(fetcher.fetchPage(url.replace("PORT", String(port)))).rejects.toThrow(
      UrlRefusedError,
    );
    expect(hits).toEqual([]);
  });

  it("refuses a host that resolves to a private address", async () => {
    await expect(localFetcher().fetchPage("http://internal.test/")).rejects.toThrow(
      /resolves to 10\.0\.0\.5/,
    );
  });

  it("refuses a host if any of its addresses is private", async () => {
    await expect(localFetcher().fetchPage("http://mixed.test/")).rejects.toThrow(
      /resolves to 192\.168\.0\.10/,
    );
  });

  it.each([
    ["/to-private", /10\.0\.0\.1/],
    ["/to-metadata", /169\.254\.169\.254/],
    ["/to-loopback-name", /loopback\.test resolves to ::1/],
  ])("refuses a redirect (%s) into the network", async (path, reason) => {
    await expect(localFetcher().fetchPage(at(path))).rejects.toThrow(reason);
    expect(hits).toEqual([path]);
  });

  it("refuses a redirect to anything but http(s)", async () => {
    await expect(localFetcher().fetchPage(at("/to-file"))).rejects.toThrow(UrlRefusedError);
  });

  it("refuses a URL that isn't http(s)", async () => {
    await expect(localFetcher().fetchPage("ftp://site.test/file")).rejects.toThrow(UrlRefusedError);
  });
});

describe("GuardedOEmbedProvider, JSON through the same guard", () => {
  const oEmbeds = (options: { timeoutMs?: number } = {}) =>
    new GuardedOEmbedProvider(localFetcher(options));

  it("reads an oEmbed answer's type and title, asking for JSON", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed.json?url=x&format=json"))).resolves.toEqual({
      type: "video",
      title: "A video",
    });
    expect(lastHeaders.accept).toBe("application/json");
    expect(lastHeaders["user-agent"]).toBe(USER_AGENT);
    expect(hits).toEqual(["/oembed.json?url=x&format=json"]);
  });

  it("titles an embedded post without a title by the text it quotes", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-post"))).resolves.toEqual({
      type: "rich",
      title: "Hello & welcome pic.twitter.com/x",
    });
  });

  it("decodes entities in a title", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-encoded"))).resolves.toEqual({
      type: "rich",
      title: "WordPress 6.7 “Rollins” & more",
    });
  });

  it("accepts a +json Content-Type and ignores fields of the wrong kind", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-plus-json"))).resolves.toEqual({
      type: "photo",
      title: null,
    });
  });

  it("follows a redirect", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/to-oembed"))).resolves.toMatchObject({
      type: "video",
    });
    expect(hits).toEqual(["/to-oembed", "/oembed.json"]);
  });

  it.each([
    ["/oembed-html", /isn't JSON/],
    ["/oembed-big", /more than 65536 bytes/],
    ["/oembed-endless", /more than 65536 bytes/],
    ["/oembed-not-json", SyntaxError],
    ["/oembed-array", /isn't an oEmbed object/],
    ["/oembed-missing", /answered 404/],
    ["/broken", /answered 503/],
  ])("rejects %s", async (path, reason) => {
    await expect(oEmbeds({ timeoutMs: 2000 }).fetchOEmbed(at(path))).rejects.toThrow(reason);
  });

  it("times out like the page fetch", async () => {
    await expect(oEmbeds({ timeoutMs: 200 }).fetchOEmbed(at("/hang"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });

  it("refuses an endpoint inside the network with the real guard, never connecting", async () => {
    const real = new GuardedOEmbedProvider(new SafeUrlFetcher());

    await expect(real.fetchOEmbed(at("/oembed.json", "127.0.0.1"))).rejects.toThrow(
      UrlRefusedError,
    );
    await expect(real.fetchOEmbed("http://169.254.169.254/oembed")).rejects.toThrow(
      UrlRefusedError,
    );
    expect(hits).toEqual([]);
  });

  it("refuses a redirect into the network", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/to-metadata"))).rejects.toThrow(/169\.254\.169\.254/);
    expect(hits).toEqual(["/to-metadata"]);
  });

  it("refuses an endpoint that isn't http(s)", async () => {
    await expect(oEmbeds().fetchOEmbed("file:///etc/passwd")).rejects.toThrow(UrlRefusedError);
  });
});
