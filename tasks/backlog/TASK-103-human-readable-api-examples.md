# TASK-103: Human Readable API Examples

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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
3. Explicitly omit browser-extension/bookmarklet capture examples from this
   parity batch.
4. Ensure generated docs remain checked for drift.
5. Avoid hand-editing generated API docs.

## Acceptance Criteria

- [ ] Generated API docs include request and response examples for core routes.
- [ ] Examples target local scripts/clients rather than browser extensions.
- [ ] Examples are sourced from `docs/api-contract.json` or generated fixtures.
- [ ] Docs drift check fails if examples become stale.
- [ ] Existing API docs links remain valid.
- [ ] `npm run docs:api:check` covers the generated output.

## Dependencies

- Coordinates with TASK-102 and TASK-111 where examples depend on new auth or
  export fields.
