import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Bundle the internal @cue-memory/* workspace packages — they're plain
  // TypeScript source, never compiled to JS, and plain `node dist/index.js`
  // can't execute them at runtime unlike tsx's esbuild-based dev resolution.
  // skipNodeModulesBundle flips the default the other way: everything else
  // resolved from node_modules — including transitive deps pulled in only
  // through those workspace packages (ioredis, bullmq, postgres via
  // @cue-memory/items/shared-kernel, invisible to tsup's own package.json-based
  // auto-external detection) — stays external automatically, rather than
  // needing every transitive dependency hand-listed.
  noExternal: [/^@cue-memory\//],
  skipNodeModulesBundle: true,
});
