# TASK-104: OpenAPI Contract Output

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] OpenAPI output is generated from the source API contract.
- [ ] Output includes documented local daemon routes intended for client use.
- [ ] Generated file is checked for drift.
- [ ] Docs describe how local client authors should consume it.
- [ ] Contract tests catch route behavior that diverges from the generated
      spec.

## Dependencies

- Coordinates with TASK-103 so human-readable and machine-readable API docs stay
  generated from the same source contract.
