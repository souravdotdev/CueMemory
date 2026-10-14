import type { IncomingHttpHeaders } from "node:http";

/** Node's request headers as web `Headers`, the form Better Auth and `ISessionProvider` take. */
export function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) webHeaders.append(name, item);
    }
  }
  return webHeaders;
}
