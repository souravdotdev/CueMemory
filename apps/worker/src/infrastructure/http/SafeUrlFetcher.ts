import { lookup as dnsLookup } from "node:dns/promises";
import type { IncomingMessage, RequestOptions } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { injectable, unmanaged } from "inversify";
import type { FetchedPage, IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import { mediaTypeOf } from "@/domain/rules/mediaType";
import { isPublicAddress } from "@/infrastructure/http/publicAddress";

export const USER_AGENT = "CueMemory/1.0 (+link preview; classifies saved links)";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface SafeUrlFetcherOptions {
  /** Every address a hostname resolves to. Defaults to the system resolver. */
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  /** Which addresses may be connected to. Defaults to public addresses only; tests widen it to reach a local server. */
  isAllowedAddress?: (address: string) => boolean;
  /** For the whole fetch, redirects and body included. */
  timeoutMs?: number;
  /** How much of an HTML body is read at most. */
  maxBytes?: number;
  maxRedirects?: number;
}

/** A fetch the guard refused: a blocked address, a non-HTTP(S) URL, or too many redirects. */
export class UrlRefusedError extends Error {
  override name = "UrlRefusedError";
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);
const HEAD_END = /<\/head\s*>/i;

const systemResolve = async (hostname: string): Promise<ResolvedAddress[]> =>
  dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Fetches a Source URL once, guarded against server-side request forgery:
 * every address the host resolves to must be public, and the connection is
 * pinned to those checked addresses (so a second DNS answer can't swap in an
 * internal one); redirects are followed by hand, each hop checked the same
 * way, at most 5; the whole fetch times out after 10 s; at most ~1 MB of an
 * HTML body is read, and only up to `</head>`. Other bodies aren't read.
 * The container builds it with the defaults; tests construct it directly to
 * pass options.
 */
@injectable()
export class SafeUrlFetcher implements IUrlFetcher {
  private readonly resolve: (hostname: string) => Promise<ResolvedAddress[]>;
  private readonly isAllowedAddress: (address: string) => boolean;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;

  // Not injected: the container leaves it undefined, so the defaults apply.
  constructor(@unmanaged() options: SafeUrlFetcherOptions = {}) {
    this.resolve = options.resolve ?? systemResolve;
    this.isAllowedAddress = options.isAllowedAddress ?? isPublicAddress;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxBytes = options.maxBytes ?? 1024 * 1024;
    this.maxRedirects = options.maxRedirects ?? 5;
  }

  async fetchPage(sourceUrl: string): Promise<FetchedPage> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      return await this.follow(new URL(sourceUrl), signal);
    } catch (error) {
      if (signal.aborted && !(error instanceof UrlRefusedError)) {
        throw new Error(`Fetching ${sourceUrl} timed out after ${this.timeoutMs} ms`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  private async follow(start: URL, signal: AbortSignal): Promise<FetchedPage> {
    let url = start;
    for (let redirects = 0; ; redirects++) {
      const response = await this.get(url, signal);
      const location = response.headers.location;
      if (!REDIRECT_STATUSES.has(response.statusCode ?? 0) || !location) {
        return this.read(url, response, signal);
      }
      response.destroy();
      if (redirects >= this.maxRedirects) {
        throw new UrlRefusedError(`${start.href} redirects more than ${this.maxRedirects} times`);
      }
      url = new URL(location, url);
    }
  }

  /** One GET, sent only to addresses the guard has checked. */
  private async get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new UrlRefusedError(`Only http and https URLs are fetched, not ${url.protocol}`);
    }
    const addresses = await this.checkedAddresses(url.hostname);
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const options: RequestOptions = {
      method: "GET",
      signal,
      // A fresh socket per request: never one pooled for another address.
      agent: false,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-encoding": "identity",
      },
      // Connect only to the addresses just checked. (An IP-literal host is
      // connected to directly, without a lookup; it was checked above.)
      lookup: pinnedLookup(addresses),
    };
    return new Promise((resolve, reject) => {
      const request = send(url, options, resolve);
      request.on("error", reject);
      request.end();
    });
  }

  /** The host's addresses, each one checked; throws if any isn't allowed. */
  private async checkedAddresses(hostname: string): Promise<ResolvedAddress[]> {
    // An IPv6 literal's hostname keeps its brackets.
    const host = hostname.replace(/^\[(.*)\]$/, "$1");
    const family = isIP(host);
    const addresses = family !== 0 ? [{ address: host, family }] : await this.resolve(host);
    if (addresses.length === 0) throw new Error(`${host} has no addresses`);
    const refused = addresses.find(({ address }) => !this.isAllowedAddress(address));
    if (refused) {
      throw new UrlRefusedError(`${host} resolves to ${refused.address}, which isn't public`);
    }
    return addresses;
  }

  private async read(
    url: URL,
    response: IncomingMessage,
    signal: AbortSignal,
  ): Promise<FetchedPage> {
    const status = response.statusCode ?? 0;
    // A server error or rate limit may pass: fail the attempt so the job retries.
    if (status >= 500 || status === 429) {
      response.destroy();
      throw new Error(`Fetching ${url.href} answered ${status}`);
    }
    // Any other unsuccessful answer says nothing about the page: it stays a Link.
    if (status < 200 || status >= 300) {
      response.destroy();
      return { contentType: null, htmlHead: null };
    }

    const contentType = response.headers["content-type"] ?? null;
    if (!HTML_TYPES.has(mediaTypeOf(contentType))) {
      response.destroy();
      return { contentType, htmlHead: null };
    }
    return { contentType, htmlHead: await this.readHead(response, signal) };
  }

  /** The body up to `</head>`, reading at most `maxBytes`. */
  private async readHead(response: IncomingMessage, signal: AbortSignal): Promise<string> {
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      for await (const chunk of response as AsyncIterable<Buffer>) {
        if (signal.aborted) throw signal.reason;
        chunks.push(chunk);
        length += chunk.length;
        if (length >= this.maxBytes || HEAD_END.test(chunk.toString("latin1"))) break;
      }
    } finally {
      response.destroy();
    }
    const text = Buffer.concat(chunks).subarray(0, this.maxBytes).toString("utf8");
    const end = HEAD_END.exec(text);
    return end ? text.slice(0, end.index + end[0].length) : text;
  }
}

/** A `lookup` for `http.request` that answers only with already-checked addresses. */
function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const wanted = options.family === 4 || options.family === 6 ? options.family : 0;
    const candidates = addresses.filter(({ family }) => wanted === 0 || family === wanted);
    if (candidates.length === 0) {
      const error = Object.assign(new Error("No checked address for the requested family"), {
        code: "ENOTFOUND",
      });
      callback(error, "", 0);
      return;
    }
    if (options.all) {
      (callback as unknown as (error: null, addresses: ResolvedAddress[]) => void)(
        null,
        candidates,
      );
    } else {
      callback(null, candidates[0]!.address, candidates[0]!.family);
    }
  };
}
