# TASK-104: OpenAPI Contract Output

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** API / tooling
**Source:** PAR-023
**Labels:** grimoire-parity, api, openapi

## Description

Add OpenAPI-compatible output for local integration clients.

## Scope

1. Map the existing source contract to OpenAPI-compatible schemas and paths.
2. Include auth, request, response, error, query, and pagination shapes.
3. Add generation and drift-check commands.
4. Document limitations where the internal contract cannot map exactly.

## Acceptance Criteria

- [x] OpenAPI output is generated from the source API contract.
- [x] Output includes documented local daemon routes intended for client use.
- [x] Generated file is checked for drift.
- [x] Docs describe how local client authors should consume it.
- [x] Contract tests catch route behavior that diverges from the generated
      spec.

## Dependencies

- Coordinates with TASK-103 so human-readable and machine-readable API docs stay
  generated from the same source contract.

## Work Notes

- June 1, 2026: Extended the source-of-truth API docs generator to emit
  `docs/openapi.json` alongside `API.md` and `docs/api-contract.json`.
- Added OpenAPI 3.0 path, parameter, request body, response, schema, tag,
  server, and bearer-token security output from `daemon/src/api/contract.ts`.
  Hono `ALL` routes are represented by the primary client `POST` method with
  `x-little-imp-source-method` so local client tooling gets a valid OpenAPI
  operation while preserving the daemon source method.
- Added `docs:openapi` and `docs:openapi:check` commands, with
  `docs:api:check` continuing to check every generated API artifact.
- Added focused generator coverage for OpenAPI metadata, transformed path
  parameters, query parameters, response schemas, pagination components, and
  MCP bearer-token security. Review hardening removed empty `required` arrays
  from optional-object schemas so generated OpenAPI is cleaner for validators
  and client generators.
- Verification passed for focused generator tests, `npm run docs:api:check`,
  `npm run docs:openapi:check`, `npm run check`, and `git diff --check`.
- Moved to `done` on June 1, 2026 after review hardening and final
  verification.
