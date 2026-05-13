# TASK-045: Create a Source-of-Truth API Contract and Regenerated Docs

**Status:** todo
**Priority:** medium
**Phase:** v0-beta hardening
**Area:** API, documentation, tooling

## Description

`API.md` currently documents endpoints and payloads that do not match the daemon implementation. Examples include old bookmark action endpoints, old flat settings keys, and query parameter names that are not accepted by current routes. The API doc generator is a regex-based parser and cannot reliably produce accurate request/response contracts.

This task establishes the daemon-owned API contract and regenerates API documentation from it. TASK-046 should consume this contract in the frontend; it should not define a second schema source.

## Current evidence

- `scripts/generate-api-docs.ts` parses route files with regex and fills in generic request/response descriptions.
- Daemon route handlers use route-local validation and response construction, not a single exported contract.
- `src/lib/api.ts` defines frontend-local types that have already drifted from the daemon settings schema.

## Dependencies / sequencing

- Coordinate with TASK-043 so the generated docs drift check becomes part of CI.
- TASK-046 depends on this task's exported contract or generated types.

## Work

1. Introduce daemon route schemas for request bodies, query parameters, path parameters, success responses, and error responses.
2. Generate an OpenAPI document or equivalent machine-readable contract from those schemas.
3. Export generated or inferred TypeScript DTOs for TASK-046 to consume.
4. Regenerate `API.md` from the contract, not from a best-effort regex parser.
5. Correct documented settings payloads to match the nested daemon settings schema.
6. Correct bookmark actions to reflect the implemented `PUT /bookmarks/:id`, `POST /bookmarks/:id/restore`, and `DELETE /bookmarks/:id/permanent` flows.
7. Update examples to include backup schedule, backup destination, S3 test, restore, MCP, and related bookmarks.
8. Provide a docs drift check command for TASK-043 to run in CI.

## Acceptance Criteria

- [ ] `API.md` matches all implemented route paths in `daemon/src/routes`.
- [ ] Documented request bodies match daemon validation.
- [ ] Documented error shapes match the actual error responses.
- [ ] The docs generator is schema-based or contract-based.
- [ ] A local command fails when generated API docs are stale.
- [ ] README links point to the regenerated API docs.
