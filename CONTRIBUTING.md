# Contributing To Grimoire

Grimoire is a local-first bookmark manager with a React/Vite frontend and a
Bun/Hono/SQLite daemon. Contributions should preserve the loopback-first,
single-user release posture unless a task explicitly reopens that product and
security decision.

## Prerequisites

- Bun 1.x or later
- Node.js 18 or later
- npm
- Git
- Docker, only for container or installed-artifact validation

If your environment does not have Node.js or Bun, provision the repository's
portable local tools:

```sh
npm run tools:setup
export PATH="$PWD/local/bin:$PATH"
```

The `local/` directory is ignored by Git.

## Development Setup

```sh
git clone https://github.com/goniszewski/grimoire.git
cd grimoire

npm install
cd daemon && bun install
cd ..
```

Run the daemon and frontend in separate terminals:

```sh
npm run daemon:dev
```

```sh
npm run dev
```

The frontend runs at `http://127.0.0.1:8080`. The daemon listens on
`http://127.0.0.1:3210`.

## Project Structure

```text
grimoire/
  src/          React app, components, hooks, pages, tests, and API client
  daemon/       Bun/Hono daemon, routes, SQLite repositories, pipeline, tests
  docs/         Public product, operations, API, and presentation documentation
  CONTEXT.md    Pointer to the maintainer-only task and evidence workspace
  scripts/      Release, docs, validation, and smoke-test helpers
  e2e/          Playwright end-to-end tests
  Formula/      In-repository Homebrew formula
```

## Running Tests

Fast local checks:

```sh
npm run lint
npm run type-check
npm run test
npm run test:daemon
```

Canonical local quality gate:

```sh
npm run check
```

`npm run check` runs the fast checks, API docs drift check, and production
build.

End-to-end tests:

```sh
npm run test:e2e:install
npm run test:e2e
```

Release and packaging checks, when relevant:

```sh
npm run release:validate
npx vitest run scripts/homebrew-formula.test.ts
npm run test:e2e:installed
```

Use focused tests for narrow changes, then broaden verification when a change
touches shared behavior, API contracts, public documentation, or user-visible
flows.

## Development Guidelines

- Use TypeScript throughout the frontend and daemon.
- Keep frontend daemon access centralized in `src/lib/api.ts` and shared API
  contract helpers.
- Keep daemon route handlers thin. Persistence belongs in `daemon/src/db/`,
  pipeline behavior in `daemon/src/pipeline/`, update behavior in
  `daemon/src/update/`, and reusable network/security logic in
  `daemon/src/lib/`.
- Keep the daemon bound to loopback by default. Do not widen network exposure
  without a security review.
- Preserve SQLite migration ordering. Do not rewrite shipped migrations.
- Use existing UI components under `src/components/ui/` and icons from
  `lucide-react`.
- Keep comments sparse and useful.
- Preserve unrelated working-tree changes.

## API And Documentation Changes

For daemon route, request, response, or error-shape changes:

```sh
npm run docs:api
npm run docs:api:check
```

The source API contract lives in `daemon/src/api/contract.ts`. Generated
outputs are [API.md](./API.md), [docs/api-contract.json](./docs/api-contract.json),
and [docs/openapi.json](./docs/openapi.json).

## Private Project Workspace

The public checkout intentionally excludes the maintainer's task board and
task-report evidence. `CONTEXT.md` points to the sibling workspace used for
those records:

```text
../_project-work/grimoire/tasks/
../_project-work/grimoire/docs/task-reports/
```

When working in the maintainer checkout, keep task IDs and status in the
external board, update an existing task instead of creating a duplicate, and
follow the external task-report `INSTRUCTION.md` for non-trivial work. Do not
recreate `tasks/` or `docs/task-reports/` in the public repository.

## Pull Requests

1. Keep changes focused.
2. Explain the user-facing behavior, API behavior, or documentation outcome.
3. Include screenshots or other relevant user-facing evidence for visible changes.
4. List verification commands and any checks that could not be run.
5. Use semantic commit messages, for example `docs: refresh public README`.

Public one-command, published-artifact, and Homebrew validation must not be
claimed while unauthenticated release URLs return `404`.
