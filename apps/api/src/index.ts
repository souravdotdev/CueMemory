// Before anything that declares a decorated class.
import "reflect-metadata";
import { buildApp } from "@/app";
import { createContainer } from "@/di/container";
import { TOKENS } from "@/di/tokens";
import type { Env } from "@/env";

const container = createContainer();
const app = await buildApp(container, { logger: true });

const { PORT, HOST } = container.get<Env>(TOKENS.Env);

app.listen({ port: PORT, host: HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
