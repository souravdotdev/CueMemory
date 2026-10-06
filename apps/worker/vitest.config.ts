import { mergeConfig } from "vitest/config";
import { nodeConfig } from "@cue-memory/vitest-config/node";

export default mergeConfig(nodeConfig, {
  test: {
    // No logic here yet — index.ts is a placeholder pending the schema
    // redesign. See docs/testing.md.
    passWithNoTests: true,
  },
});
