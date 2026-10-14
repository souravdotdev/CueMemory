// Before anything that declares a decorated class.
import "reflect-metadata";
import { buildApp } from "@/app";
import { createContainer } from "@/di/container";
import { TOKENS } from "@/di/tokens";
import type { Env } from "@/env";

const container = createContainer();
const app = await buildApp(container, { logger: true });

app.listen({ port: container.get<Env>(TOKENS.Env).PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
