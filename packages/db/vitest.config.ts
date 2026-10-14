import { mergeConfig } from "vitest/config";
import { nodeConfig } from "@cue-memory/vitest-config/node";

export default mergeConfig(nodeConfig, {});
