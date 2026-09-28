import { mergeConfig } from "vitest/config";
import { nodeConfig } from "@cue-memory/vitest-config/node";

export default mergeConfig(nodeConfig, {
  test: {
    // No pure/isolable logic here — composition.ts and index.ts are just
    // wiring; the actual job-processing logic they wire together is tested
    // in @cue-memory/items. See docs/testing.md.
    passWithNoTests: true,
  },
});
