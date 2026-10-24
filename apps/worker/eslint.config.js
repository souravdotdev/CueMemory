import { config } from "@resonory/eslint-config/node-library";

// The dependency rule (docs/clean-architecture.md): domain and application
// code never import tools. Persistence, queue and cache libraries are reached
// only through ports implemented in infrastructure.
const toolImports = [
  { group: ["drizzle-orm", "drizzle-orm/*"], message: "Drizzle belongs in infrastructure." },
  { group: ["bullmq", "bullmq/*"], message: "BullMQ belongs in infrastructure or interface." },
  { group: ["postgres", "postgres/*"], message: "Postgres belongs in infrastructure." },
  { group: ["ioredis", "ioredis/*"], message: "Redis belongs in infrastructure." },
  {
    group: ["htmlparser2", "htmlparser2/*"],
    message: "HTML parsing belongs in infrastructure; rules read the extracted PageHead.",
  },
  { group: ["sharp", "sharp/*"], message: "Image decoding belongs in infrastructure." },
  { group: ["@supabase/*"], message: "Supabase Storage belongs in infrastructure." },
  {
    group: ["@resonory/db", "@resonory/db/*"],
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
