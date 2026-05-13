# TASK-043: Restore Quality Gates and Add CI

**Status:** done
**Priority:** high
**Phase:** v0-beta hardening
**Area:** testing, CI, TypeScript, lint

## Description

The test suite has useful coverage, but the project is not currently in a green, enforceable state. Local checks are split across npm, Bun, TypeScript, Vitest, and Playwright with no single documented contract. There is no GitHub Actions workflow, and the pre-commit hook only runs daemon tests.

This task restores confidence by making all quality gates pass and enforcing them consistently.

## Current evidence / known gaps

- `npm run lint` fails with multiple ESLint errors, mostly test `any`, empty blocks, control-regex, no-empty-object-type, and `require()` import usage.
- `bun run check` fails because test fetch mocks no longer satisfy Bun's `typeof fetch`.
- `npx tsc --noEmit -p tsconfig.app.json` fails on an unused `@ts-expect-error`.
- `npm run test:e2e` fails when Playwright browsers are missing.
- `.github/` is absent.
- `.husky/pre-commit` currently runs only `cd daemon && bun test`.

## Dependencies / sequencing

- This can start immediately for lint/type/test repair.
- Add docs drift and generated-contract checks after TASK-045 introduces the source-of-truth API contract.
- Add Docker build/health validation after TASK-042 decides the supported Docker topology.

## Work

1. Fix or intentionally configure all current ESLint failures.
2. Fix daemon test fetch mocks against current Bun typings.
3. Add root scripts for frontend type-check, daemon type-check, daemon tests, and the canonical combined check.
4. Ensure Playwright setup is reproducible through `npx playwright install --with-deps` in CI and documented local setup.
5. Add GitHub Actions for install, lint, type-check, frontend unit tests, daemon tests, build, and E2E where practical.
6. Add generated API docs drift checks once TASK-045 supplies the generator/contract.
7. Add Docker build and health validation once TASK-042 supplies the release Docker topology.
8. Update Husky hooks so local checks match the CI contract without making every commit run the slowest checks.
9. Document the canonical local verification command set in CONTRIBUTING.md.

## Acceptance Criteria

- [x] `npm run lint` passes.
- [x] Frontend type-check passes through an npm script.
- [x] `cd daemon && bun run check` passes.
- [x] `npm run test` passes.
- [x] `cd daemon && bun test` passes.
- [x] `npm run build` passes.
- [x] `npm run test:e2e` runs after documented browser installation.
- [x] Generated docs/contract checks are enforced once TASK-045 lands.
- [x] GitHub Actions enforces the agreed checks on pull requests.

## Completion Notes

- Added root quality scripts, GitHub Actions checks, and a faster Husky pre-commit gate.
- Fixed lint/type-check failures across frontend, daemon, and tests without broad test-only suppressions.
- Verified with `npm run check`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run type-check:daemon`, and `git diff --check`.
