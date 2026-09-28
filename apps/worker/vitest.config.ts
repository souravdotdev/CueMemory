import { mergeConfig } from "vitest/config";
import { nodeConfig } from "@second-brain/vitest-config/node";

export default mergeConfig(nodeConfig, {
  test: {
    // No pure/isolable logic here — composition.ts and index.ts are just
    // wiring; the actual job-processing logic they wire together is tested
    // in @second-brain/items. See docs/testing.md.
    passWithNoTests: true,
  },
});
