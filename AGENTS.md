# AGENTS.md

Guidance for coding agents working in this repository.

## Project Snapshot

- Grimoire is a local-first bookmark manager.
- The frontend is a React 18 + Vite + TypeScript SPA under `src/`.
- The background daemon is a Bun service under `daemon/` that listens on `127.0.0.1:3210`, stores data in SQLite, and exposes the REST API used by the frontend.
- Current release: `1.0.0`.

## First Reads

Before meaningful edits, skim:

- `README.md` for product shape, installation paths, and development expectations.
- `docs/overview.md` and `docs/prd.md` for product context.
- `docs/api-contract.json` and `API.md` before changing daemon routes or frontend API clients.
- `docs/task-reports/INSTRUCTION.md` for every non-trivial task so visual task reports and index links stay consistent.
- Relevant task file under `tasks/` if the work maps to a task ID.

## Repository Layout

- `src/`: React app, UI components, hooks, pages, types, and frontend tests.
- `daemon/`: Bun daemon, REST routes, SQLite repositories, migrations, pipeline workers, CLI, and daemon tests.
- `docs/`: product, release, operational, API, presentation, and task-report documentation.
- `tasks/`: local file-based implementation board.
- `scripts/`: release, validation, documentation, and smoke-test helpers.
- `release/`: generated release artifacts and manifests.
- `dist/`: built frontend output.

## Architecture Rules

- Keep the daemon bound to loopback by default. Do not widen network exposure without an explicit security review.
- Treat `docs/api-contract.json` as the source of truth for generated API docs and shared API expectations.
- Keep frontend API access centralized in `src/lib/api.ts` and shared contract helpers rather than duplicating fetch logic across components.
- Keep daemon route handlers thin. Put persistence in `daemon/src/db/`, pipeline behavior in `daemon/src/pipeline/`, update logic in `daemon/src/update/`, and reusable network/security logic in `daemon/src/lib/`.
- Preserve SQLite migration ordering and never rewrite existing migrations that may have shipped.
- Do not introduce cloud dependencies or remote persistence into normal user flows unless the task explicitly asks for it.
- Keep release packaging and installer behavior conservative: upgrades must preserve user data under `~/.local/share/littleimp`.

## TypeScript And UI Style

- Use TypeScript throughout the frontend and daemon. Prefer explicit return types on exported functions and public helpers.
- Follow existing React patterns: functional components, hooks for data access/state coordination, and Radix/shadcn primitives for common UI.
- Prefer existing UI components in `src/components/ui/` and icons from `lucide-react`.
- Keep operational UI dense, readable, and task-focused. Avoid marketing-style sections inside app screens.
- Maintain responsive layouts and verify narrow widths when changing pages, dialogs, sidebars, or tables.
- Keep comments sparse and useful; explain non-obvious behavior, not basic assignments.

## Data, Docs, And Task Hygiene

- Keep task IDs stable and move Markdown task files between `tasks/backlog`, `todo`, `in-progress`, `in-review`, and `done` as appropriate.
- Prefer updating an existing task over creating a duplicate.
- Do not hand-edit generated docs when the generator is the source of truth. Use `npm run docs:api` for API documentation updates.
- For non-trivial visible, flow, documentation-presentation, release-packaging, or runtime-behavior work, create or update a task report under `docs/task-reports/` following `docs/task-reports/INSTRUCTION.md`.

## Verification

- Run `npm run lint`, `npm run type-check`, and the focused frontend tests for frontend changes.
- Run `npm run test:daemon` or focused Bun tests for daemon changes.
- Run `npm run docs:api:check` when API contracts or route behavior may affect generated docs.
- Run `npm run build` for changes that affect bundling, routing, Tailwind, or release output.
- Run `npm run test:e2e` for user-flow changes that affect core app behavior.
- For meaningful UI layout, visibility, interaction, or styling changes, launch the app, capture screenshots of the affected desktop and mobile/narrow states, inspect them, and include relevant assets in the task report.
- If verification cannot be run locally (no system node/bun), see **Tooling Fallbacks** below to provision portable runtimes.

## Tooling Fallbacks

If `node` or `bun` is unavailable on the host (e.g., in sandboxed agent
environments), use the portable runtimes under `local/bin/`.

Run once to provision:

```sh
npm run tools:setup
```

Or directly:

```sh
bash scripts/setup-local-tools.sh
```

Then prefix all commands with:

```sh
export PATH="$PWD/local/bin:$PATH"
```

This makes `node`, `npm`, `npx`, and `bun` available for running tests,
type-checks, linting, API doc generation, and builds. The `local/` directory
is git-ignored and never enters version control.

## Collaboration Rules

- Preserve unrelated working-tree changes. Do not revert user edits unless explicitly asked.
- Keep changes tightly scoped to the requested task and current release constraints.
- Do not commit, push, publish release artifacts, or move tasks to `done` unless the user asks or the workflow explicitly requires it.
