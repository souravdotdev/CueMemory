import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { isPublicAddress } from "@/infrastructure/http/publicAddress";
import { type ResolvedAddress, SafeUrlFetcher } from "@/infrastructure/http/SafeUrlFetcher";

export const ARTICLE_HEAD =
  '<html><head><title>An &amp; article</title><meta property="og:type" content="article">' +
  '<link rel="alternate" type="application/json+oembed" href="oembed.json"></head>';
export const PNG_START = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const BOM = String.fromCharCode(0xfeff);
// An HTML page sent without a Content-Type (Node sends none unless told to).
const UNTYPED_HTML_HEAD =
  '<head><title>Untyped</title><meta property="og:type" content="video.other"></head>';

/**
 * What the local test server has seen: every request path (with its query)
 * since the test began, and the last request's headers.
 */
export const local = {
  port: 0,
  hits: [] as string[],
  lastHeaders: {} as IncomingHttpHeaders,
};

let server: Server;
const openResponses = new Set<ServerResponse>();

/** Streams `chunk` until the client hangs up. */
function pumpForever(res: ServerResponse, chunk: string | Buffer) {
  openResponses.add(res);
  const pump = () => {
    while (!res.destroyed && res.write(chunk));
    if (!res.destroyed) res.once("drain", pump);
  };
  return pump;
}

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
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"type":"video","title":"');
      pumpForever(res, "x".repeat(64 * 1024))();
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
    case "/untyped-doctype":
      return res.writeHead(200).end(`${BOM} \n<!DOCTYPE html>\n<html>${UNTYPED_HTML_HEAD}</html>`);
    case "/untyped-html":
      return res.writeHead(200).end(`  <HTML lang="en">${UNTYPED_HTML_HEAD}<body></body></HTML>`);
    case "/untyped-head":
      return res.writeHead(200).end(UNTYPED_HTML_HEAD);
    case "/untyped-long-html": {
      // Longer than the sniffing window, its head closing well after it.
      const padding = `<meta name="x" content="${"y".repeat(2048)}">`;
      return res
        .writeHead(200)
        .end(`<!doctype html><html><head>${padding}<title>Long</title></head><body></body></html>`);
    }
    case "/untyped-header":
      // <header> isn't <head>: not HTML by its start.
      return res.writeHead(200).end("<header>Not a document</header>");
    case "/untyped-text":
      return res.writeHead(200).end(`plain text ${"z".repeat(4096)} <html><head></head></html>`);
    case "/pdf":
      return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.7");
    case "/to-article":
      return redirect("/article");
    case "/short":
      // A short link: two hops, the second to an absolute URL.
      return redirect("/short-2");
    case "/short-2":
      return redirect(`http://site.test:${local.port}/pdf`);
    case "/download":
      return res
        .writeHead(200, { "content-type": "application/octet-stream" })
        .end(Buffer.concat([PNG_START, Buffer.alloc(64 * 1024)]));
    case "/untyped":
      return res.writeHead(200).end("%PDF-1.4");
    case "/endless-binary": {
      // A download that never ends, streamed until the client hangs up.
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.write(Buffer.from([0x1a, 0x45]));
      setTimeout(pumpForever(res, Buffer.alloc(64 * 1024, 0xdf)), 20);
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
      res.writeHead(200, { "content-type": "text/html" });
      res.write("<html><head><title>Endless</title>");
      pumpForever(res, "<!-- padding -->".repeat(4096))();
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

/**
 * Starts the local test server for the calling test file. It listens on
 * loopback, which the real guard refuses, so `localFetcher` treats 127.0.0.1
 * (and only it) as public too.
 */
export function useLocalServer() {
  beforeAll(async () => {
    server = createServer((req, res) => {
      local.hits.push(req.url ?? "");
      local.lastHeaders = req.headers;
      // Routes by path only: oEmbed requests carry a query.
      route(new URL(req.url ?? "/", "http://site.test").pathname, res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    local.port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    for (const res of openResponses) res.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    local.hits = [];
  });
}

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

/** A SafeUrlFetcher that resolves the test DNS and may reach the local server. */
export function localFetcher(options: { timeoutMs?: number; maxBytes?: number } = {}) {
  return new SafeUrlFetcher({
    resolve: testResolve,
    isAllowedAddress: (address) => address === "127.0.0.1" || isPublicAddress(address),
    ...options,
  });
}

/** A URL on the local server, under a test host name. */
export const at = (path: string, host = "site.test") => `http://${host}:${local.port}${path}`;
