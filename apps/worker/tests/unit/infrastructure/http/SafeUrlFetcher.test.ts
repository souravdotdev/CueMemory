import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isPublicAddress } from "@/infrastructure/http/publicAddress";
import {
  type ResolvedAddress,
  SafeUrlFetcher,
  UrlRefusedError,
  USER_AGENT,
} from "@/infrastructure/http/SafeUrlFetcher";

const ARTICLE_HEAD = '<html><head><meta property="og:type" content="article"></head>';

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
  switch (path) {
    case "/article":
      return res
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end(ARTICLE_HEAD + "<body>…</body></html>");
    case "/pdf":
      return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.7");
    case "/to-article":
      return redirect("/article");
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
      res.write("<html><head>");
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
    route(req.url ?? "/", res);
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

describe("SafeUrlFetcher, allowed fetches", () => {
  it("fetches an HTML page's head and sends the CueMemory User-Agent", async () => {
    const page = await localFetcher().fetchPage(at("/article"));

    expect(page).toEqual({ contentType: "text/html; charset=utf-8", htmlHead: ARTICLE_HEAD });
    expect(lastHeaders["user-agent"]).toBe(USER_AGENT);
  });

  it("connects only to the checked address (site.test isn't in the real DNS)", async () => {
    await expect(localFetcher().fetchPage(at("/pdf"))).resolves.toEqual({
      contentType: "application/pdf",
      htmlHead: null,
    });
    expect(hits).toEqual(["/pdf"]);
  });

  it("follows a redirect", async () => {
    const page = await localFetcher().fetchPage(at("/to-article"));

    expect(page.htmlHead).toBe(ARTICLE_HEAD);
    expect(hits).toEqual(["/to-article", "/article"]);
  });

  it("follows up to 5 redirects", async () => {
    const page = await localFetcher().fetchPage(at("/chain/4"));

    expect(page.htmlHead).toBe(ARTICLE_HEAD);
    expect(hits).toHaveLength(6);
  });

  it("refuses a sixth redirect", async () => {
    await expect(localFetcher().fetchPage(at("/chain/5"))).rejects.toThrow(UrlRefusedError);
    expect(hits).toHaveLength(6);
  });

  it("stops reading after the size cap", async () => {
    const page = await localFetcher({ maxBytes: 64 * 1024 }).fetchPage(at("/endless"));

    expect(page.htmlHead).toMatch(/^<html><head>/);
    expect(page.htmlHead!.length).toBeLessThanOrEqual(64 * 1024);
  });

  it("stops reading the default ~1 MB in", async () => {
    const page = await localFetcher().fetchPage(at("/endless"));

    expect(page.htmlHead!.length).toBe(1024 * 1024);
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
      contentType: null,
      htmlHead: null,
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
