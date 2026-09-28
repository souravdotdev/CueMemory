import { mergeConfig } from "vitest/config";
import { nodeConfig } from "@second-brain/vitest-config/node";

export default mergeConfig(nodeConfig, {
  test: {
    // Raw connection factories only — no pure/isolable logic here yet.
    passWithNoTests: true,
  },
});
