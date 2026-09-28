# Code Quality

Three separate tools, each doing one job: ESLint (correctness/style rules), Prettier (formatting), TypeScript (types). They're kept from fighting each other — see [Formatting vs. linting](#formatting-vs-linting) below.

## TypeScript

Shared config lives in `packages/typescript-config`, three bases:

- `base.json` — strict mode, ES2022 target, bundler module resolution
- `library.json` — extends `base`, adds `declaration`/`declarationMap` (for editor go-to-definition into internal packages)
- `nextjs.json` — extends `base`, adds JSX/Next.js plugin settings

Every app/package has its own `tsconfig.json` extending one of these (never a root-level `tsconfig.json` — each package's config stays local so a change to one package's types doesn't invalidate every other package's Turborepo cache). Internal packages use Node.js subpath-style resolution (`moduleResolution: "bundler"`) rather than TS path aliases, so JIT-imported packages resolve correctly without a build step.

Pinned to `typescript@^6.0.3` everywhere — not `latest` (TypeScript 7 is out but `typescript-eslint` doesn't support it yet as a peer dependency; pinning avoids the peer-dependency conflict rather than fighting it per-install).

```bash
pnpm check-types   # tsc --noEmit in every package, via Turborepo
```

## ESLint

Shared config lives in `packages/eslint-config` (ESLint 9, flat config format):

- `base.js` — `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier` (disables any ESLint rule that would conflict with Prettier's formatting)
- `node-library.js` — thin wrapper around `base.js`; used by `apps/api`, `apps/worker`, and every `packages/*` package
- `next.js` — `base.js`'s rules plus `eslint-config-next`'s React/JSX-a11y/Next-specific rules (core-web-vitals); used only by `apps/web`

Every package has a two-line `eslint.config.js` importing the right shared config, and a `lint` script (`eslint .`).

Also pinned rather than `latest`: `eslint@^9.39.5` and `@eslint/js@^9.39.0` — `eslint-config-next`'s transitive plugins (`eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`) don't yet declare ESLint 10 as a supported peer.

```bash
pnpm lint   # eslint . in every package, via Turborepo
```

## Prettier

Root-level only — `.prettierrc.json` and `.prettierignore` at the repo root, `prettier` as a root devDependency. Formatting is a single whole-tree pass with no per-package boundary, so it isn't wired through Turborepo the way lint/check-types/build are; the root scripts call `prettier` directly.

Config (`.prettierrc.json`): `printWidth: 100`, `trailingComma: "all"` — everything else is Prettier 3's defaults.

Ignored (`.prettierignore`): `pnpm-lock.yaml`, `dist/`, `.next/`, `.turbo/`, `packages/db/drizzle/` (generated migration SQL). `node_modules` and VCS directories are ignored by Prettier automatically.

```bash
pnpm format         # prettier --write . — reformats in place
pnpm format:check   # prettier --check . — fails without writing, for CI
```

## EditorConfig

`.editorconfig` at the repo root — a single file, since EditorConfig cascades to every subdirectory from wherever `root = true` is set, so there's no per-package equivalent the way ESLint/TypeScript configs need one. It sets the baseline every editor (VS Code, WebStorm, Vim, etc.) applies _before_ Prettier ever runs — indentation, line endings, final newline, trailing whitespace — so a file looks right the moment it's opened, not just after a format pass. Values are kept in sync with `.prettierrc.json` (`indent_size: 2`, `max_line_length: 100` matching `printWidth`) so there's no drift between what the editor shows by default and what Prettier actually enforces.

One override: `[*.md]` disables `trim_trailing_whitespace` — two trailing spaces at the end of a Markdown line is a deliberate forced line break, and most editors would otherwise strip it on save.

This is a lower-level safety net than Prettier, not a replacement for it — Prettier via `lint-staged` is still what's actually enforced at commit time; EditorConfig just means an editor that doesn't run Prettier live (or hasn't loaded yet) still defaults to the right settings.

## Formatting vs. linting

`eslint-config-prettier` is included in both shared ESLint configs specifically so ESLint never flags a formatting choice that Prettier would make differently — ESLint owns correctness/best-practice rules, Prettier owns whitespace/quotes/line-wrapping. There's no actual overlap or conflict by construction.

## Git hooks

`husky` + `lint-staged` + `commitlint` enforce lint/format/commit-message conventions automatically:

- **`.husky/pre-commit`** runs `lint-staged`, which runs Prettier on every staged file and ESLint (`--fix`, with an explicit `--config` path per package — see below) on staged files under each app/package. Auto-fixed files are re-staged before the commit completes; an unfixable error blocks the commit.
- **`.husky/commit-msg`** runs `commitlint --edit "$1"` against the commit message itself (git passes it the path to a temp file containing the message). A message that doesn't follow [Conventional Commits](https://www.conventionalcommits.org) (`type: subject`, e.g. `feat: add reminder scheduling`) blocks the commit — this repo's history was already using that convention before commitlint was added, so it's enforcing an existing norm, not introducing a new one.
- **`.husky/pre-push`** runs `pnpm lint && pnpm check-types && pnpm test` across the whole repo (fast on repeat thanks to Turborepo's cache) as a last gate before code leaves the machine. See [Testing](./testing.md) for what `pnpm test` actually covers.

`.lintstagedrc.json` lists one glob per package pointing ESLint at that package's own `eslint.config.js` explicitly, rather than letting ESLint auto-discover a config from the current working directory. This is necessary because ESLint 9's flat config resolves `eslint.config.js` relative to the process's CWD (not per-file, the way the old `.eslintrc` cascading did) — a single generic `eslint` invocation from the repo root wouldn't find the right config for a file under, say, `apps/web` vs `packages/db`.

`commitlint.config.js` (root) just extends `@commitlint/config-conventional` — no project-specific rule overrides yet. If certain commit types beyond the standard set (`feat`, `fix`, `chore`, `refactor`, `docs`, etc.) or a scope convention (`feat(api): ...`) end up wanted, that's where to add them.

Not set up: editor-level format-on-save config (`.vscode/settings.json`). Reasonable to add if it becomes a friction point.

## Continuous Integration

`.github/workflows/ci.yml` — two jobs, the machine-enforced backstop for exactly what's already enforced locally (above). Local hooks only run on commits made on a machine that has them installed; CI catches `--no-verify`, a fork PR where hooks never ran, or anything else that slipped past `.husky/`.

- **`ci`** (every push to `main`, every PR): installs with `pnpm install --frozen-lockfile` (fails loudly on any `package.json`/`pnpm-lock.yaml` drift, rather than silently rewriting the lockfile), then `pnpm format:check` first since it's the fastest check, then a single `pnpm exec turbo run lint check-types test build` — the same command used for local verification throughout this project, letting Turborepo parallelize across all 12 workspace packages respecting their dependency graph rather than four separate sequential invocations. No Postgres/Redis service containers are configured — the whole point of the fakes-over-real-infra approach in [Testing](./testing.md) is that the suite doesn't need them.
- **`commitlint`** (PRs only): checks out full history and lints every commit in the PR's range against the same `commitlint.config.js` used locally — the CI-side version of what `.husky/commit-msg` already does, for the cases that hook can't reach.

There's no Turborepo Remote Cache token configured, so without help every CI run would start fully cold. `.turbo` (the local task-output cache — confirmed by inspection to be where Turborepo actually writes cached results, at the repo root) is cached across runs via `actions/cache`, keyed on the commit SHA with an OS-level restore-key fallback, so unchanged packages skip re-running instead of every run paying the full 26-task cost.

**Verified directly before relying on it**: every command the workflow runs was executed locally in the same order (including a genuinely cold-cache `turbo run` after deleting every `.turbo` directory in the repo, confirming a first CI run would actually pass, followed by a repeat run confirming all 26 tasks come back from cache), and the workflow file itself was validated with `actionlint` (a purpose-built GitHub Actions linter — checks expression syntax, job/step schema, and shellchecks every `run:` block), not just generic YAML parsing.

**Not set up**: any deploy/CD step — `apps/api`/`apps/worker`'s compiled `start` script does actually run correctly now (see [Architecture](./architecture.md#monorepo-layout)), but no hosting platform is chosen yet, so there's nowhere for a deploy job to deploy to. Also not set up: branch protection requiring the `ci` check before merge (a GitHub repo _setting_, not a file — worth turning on once this workflow has run successfully at least once).
