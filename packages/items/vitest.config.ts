import { mergeConfig } from "vitest/config";
import { nodeConfig } from "@cue-memory/vitest-config/node";

export default mergeConfig(nodeConfig, {
  test: {
    // Schema is being redesigned — no tests until the new tables land.
    passWithNoTests: true,
  },
});
