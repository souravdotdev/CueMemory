import { config } from "@cue-memory/eslint-config/node-library";

// The dependency rule (docs/clean-architecture.md): domain and application
// code never import tools. Persistence, HTTP, auth and cache libraries are
// reached only through ports implemented in infrastructure.
const toolImports = [
  { group: ["drizzle-orm", "drizzle-orm/*"], message: "Drizzle belongs in infrastructure." },
  {
    group: ["fastify", "fastify/*", "@fastify/*", "fastify-*"],
    message: "Fastify belongs in interface.",
  },
  { group: ["better-auth", "better-auth/*"], message: "Better Auth belongs in infrastructure." },
  { group: ["postgres", "postgres/*"], message: "Postgres belongs in infrastructure." },
  { group: ["ioredis", "ioredis/*"], message: "Redis belongs in infrastructure." },
  {
    group: ["@cue-memory/db", "@cue-memory/db/*"],
    message: "The database package belongs in infrastructure.",
  },
];

export default [
  ...config,
  {
    // Leading **/ so the guard also applies when lint-staged runs ESLint from
    // the repo root with --config (patterns then resolve against the cwd).
    files: ["**/src/domain/**/*.ts", "**/src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: toolImports.map(({ group, message }) => ({
            group,
            message: `Domain and application never import tools. ${message} Depend on a port instead.`,
          })),
        },
      ],
    },
  },
];
