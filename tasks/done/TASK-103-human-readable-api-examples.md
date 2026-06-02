# TASK-103: Human Readable API Examples

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** API / documentation
**Source:** PAR-022
**Labels:** grimoire-parity, api, docs

## Description

Generate human-readable API documentation from `docs/api-contract.json`,
including request and response examples.

## Scope

1. Extend the API docs generator to include curated examples from the contract
   or contract-adjacent fixtures.
2. Cover local token auth, bookmark CRUD/update, search/list/filter/sort/
   pagination, import/export, categories, tags, backup, and common error flows.
3. Explicitly omit packaged browser-extension/bookmarklet client examples from
   this parity batch.
4. Ensure generated docs remain checked for drift.
5. Avoid hand-editing generated API docs.

## Acceptance Criteria

- [x] Generated API docs include request and response examples for core routes.
- [x] Examples target local scripts/clients rather than browser extensions.
- [x] Examples are sourced from `docs/api-contract.json` or generated fixtures.
- [x] Docs drift check fails if examples become stale.
- [x] Existing API docs links remain valid.
- [x] `npm run docs:api:check` covers the generated output.

## Dependencies

- Coordinates with TASK-102 and TASK-111 where examples depend on new auth or
  export fields.

## Work Notes

- June 1, 2026: Started as the next unblocked high-priority Grimoire parity
  backlog task after TASK-102. TASK-078 and TASK-079 remain blocked on public
  artifact visibility, while TASK-097 and TASK-098 are already in review.
- Added response-aware API examples to the source contract and generator:
  examples now support status, content type, headers, and JSON/text bodies.
- Added generated request/response examples for integration tokens, MCP token
  failure, bookmark create/list/detail/update, search filtering and pagination,
  import/export, categories, tags, backup, and common 4xx flows. Packaged
  browser extension and bookmarklet client examples remain omitted for this
  parity batch.
- Current generated examples do not invent sort query parameters because the
  API contract does not expose server-driven sorting yet; TASK-115 owns that
  future surface.
- Regenerated `API.md` and `docs/api-contract.json`. Added task-report evidence
  at
  `docs/task-reports/2026/06/2026-06-01-task-103-api-examples/index.html`.
- TDD evidence: `npx vitest run scripts/api-docs-generator.test.ts` failed RED
  with missing response examples, then passed with 8/8 tests after
  implementation and review fixes.
- Verification passed: `npm run check`, including lint, frontend and daemon
  type-checks, frontend tests, daemon tests, API docs drift check, and build.
  Existing Fast Refresh, React Router future-flag, Browserslist, and chunk-size
  warnings remain.
- June 1, 2026: Review fixes aligned examples with immediate route behavior,
  including bookmark create state, local backup output, category metadata, and
  invalid URL problem details. Focused generator coverage now passes with 8/8
  tests.
