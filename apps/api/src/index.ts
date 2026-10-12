import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "@cue-memory/auth";
import { auth } from "./auth";
import { registerContracts } from "./contracts";
import { env } from "./env";
import { rateLimitRedis } from "./rate-limit-redis";

const app = registerContracts(Fastify({ logger: true }));

// Credentials, so the browser sends and accepts the Session cookie cross-origin (ADR 0003).
await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: rateLimitRedis,
  nameSpace: "cue-memory-api-rate-limit-",
});

// Before every other route, and stricter than the global limit above.
await app.register(authRoutes, { auth, rateLimit: { max: 30, timeWindow: "1 minute" } });

app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
