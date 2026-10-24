import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  // See apps/api/tsup.config.ts for the full rationale — same setup here.
  // esbuild reads the `@/` alias from tsconfig.json.
  noExternal: [/^@resonory\//],
  skipNodeModulesBundle: true,
});
