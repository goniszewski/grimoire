# CLAUDE.md — Grimoire 1.0

## Project

Local-first bookmark manager. Frontend: React 18 + Vite + TypeScript (`src/`). Daemon: Bun + Hono (`daemon/`) bound to `127.0.0.1:3210`, SQLite storage.

## Commands

- `npm run dev` — start daemon + frontend dev servers
- `npm run build` — type-check + lint + build frontend
- `npm run lint` — ESLint
- `npm run type-check` — TypeScript
- `npm run test:frontend` — Vitest unit tests (src/)
- `npm run test:daemon` — Bun tests (daemon/)
- `npm run test:e2e` — Playwright end-to-end
- `npm run check` — lint + type-check + test:frontend
- `npm run docs:api` — regenerate API docs from contract
- `npm run docs:api:check` — verify API docs are current
- `npm run tools:setup` — provision portable node/bun under `local/bin/`

## Architecture Rules

1. **Daemon is loopback-only.** Default bind `127.0.0.1:3210`. No cloud dependencies in normal user flows.
2. **SQLite schema is sacred.** Never autonomously alter migrations that may have shipped. Add new migrations only.
3. **API contract is source of truth.** Update `docs/api-contract.json` first, then implement. Run `npm run docs:api:check` after route changes.
4. **Frontend API access** goes through `src/lib/api.ts`. No direct `fetch` in components.
5. **Route handlers are thin.** Put persistence in `daemon/src/db/`, pipeline behavior in `daemon/src/pipeline/`, update logic in `daemon/src/update/`.
6. **No unverified code merges.** Always run `npm run check` and `npm run test:e2e` before committing or merging.

## Boundaries (Never Do Without Human Approval)

- Do not open network ports beyond loopback
- Do not add remote persistence, telemetry, or cloud services
- Do not modify or delete existing SQLite migrations
- Do not rewrite `AGENTS.md` or this file
- Do not commit to `main` or `develop` directly
- Do not publish release artifacts

## Commit Style

Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`, `perf:`). Reference task IDs when applicable: `feat(TASK-123): description`.

## Git Workflow

- `develop` — active work
- Feature branches from `develop`
- `main` — tagged releases only
- Squash merge feature branches; keep develop history clean
