import IORedis from "ioredis";
import { redisEnv } from "./env";

export const redisConnection = new IORedis(redisEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});
