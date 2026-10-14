# Auth lives on the API, with subdomain cookies

Better Auth runs inside the Fastify API (`apps/api`), which is the only app that reads and writes the auth tables declared in `packages/db` (`users`, `sessions`, and `accounts` for Sign-in identities), and the Next.js web app (`apps/web`) is only a client of it. The browser calls the API directly, cross-origin with credentials, for sign-in, sign-out and every other request, so there's one auth server and one place that decides who a User is. In production the web app and the API sit on sibling subdomains, `app.<domain>` and `api.<domain>`, and the API sets the Session cookie on the parent domain (cross-subdomain, `SameSite=Lax`, `Secure`). Both origins then receive the cookie: the browser sends it to the API, and the Next.js server can forward it to the API to check the Session before rendering a signed-in page. Locally, the web app and the API run on two ports of `localhost`, which already share cookies, so no cookie domain is needed (CORS with credentials still is).

## Considered Options

- **Run auth in Next.js**: Better Auth has a first-class Next.js integration, but the API would then have to trust sessions it doesn't own, either by reading the auth tables itself or by calling back into Next.js on every request. Two apps would hold auth logic, and every non-web client, such as the browser extension, would depend on the web app being up.
- **Proxy the API through Next.js rewrites**: keeps everything same-origin, so cookies need no domain setup. But every API request takes an extra hop through the Next.js server, uploads and long requests are bound by its limits, and the API's real origin is hidden behind a layer that has to be kept in sync with its routes.

## Consequences

- The API has to allow the web origin with credentials in CORS, and trusted origins have to be configured for Better Auth. A wildcard origin is never allowed.
- The cookie domain is configuration: the parent domain in production, unset locally. Web and API must stay on sibling subdomains of one domain; moving either one to an unrelated domain breaks the shared Session cookie and reopens this decision.
- `SameSite=Lax` keeps the cookie off cross-site subrequests, but `app.<domain>` and `api.<domain>` count as the same site, so it gives no protection between them or any other subdomain. Better Auth's origin checks and the strict CORS allow-list carry the CSRF defence for state-changing routes.
- The Next.js server never verifies a Session on its own. It forwards the cookie and asks the API, so the API stays the only authority on whether a Session is valid and whether its User is deleted.
