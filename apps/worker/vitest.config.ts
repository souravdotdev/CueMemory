import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { nodeConfig } from "@resonory/vitest-config/node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    // The `@/` alias from tsconfig.json.
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  }),
);
