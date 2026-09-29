import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env";
import { rateLimitRedis } from "./rate-limit-redis";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: rateLimitRedis,
  nameSpace: "cue-memory-api-rate-limit-",
});

app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
