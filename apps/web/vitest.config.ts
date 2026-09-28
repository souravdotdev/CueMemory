import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";
import { reactConfig } from "@cue-memory/vitest-config/react";

export default mergeConfig(reactConfig, {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
