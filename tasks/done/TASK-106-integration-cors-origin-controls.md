# TASK-106: Integration CORS And Origin Controls

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** daemon / security / integrations
**Source:** PAR-026
**Labels:** grimoire-parity, security, cors, integrations

## Description

Add CORS and origin policy controls with documentation for local integration
clients.

## Scope

1. Define allowed origin defaults for the local frontend and configured local
   clients.
2. Add configuration for additional trusted origins where appropriate.
3. Ensure preflight and failure responses are predictable.
4. Document setup and risks for integration clients.

## Acceptance Criteria

- [x] Default origin policy remains conservative.
- [x] Approved integration origins can be configured deliberately.
- [x] Unsafe origins are rejected with clear behavior.
- [x] Docs include local client configuration examples and explicitly omit
      extension/bookmarklet examples for this batch.
- [x] Tests cover allowed, missing, unsafe, and configured origins.

## Dependencies

- Depends on TASK-087 and coordinates with TASK-102.

## Work Notes

- Added explicit `403` handling for unsafe CORS preflight requests from
  rejected origins before generic CORS middleware handling.
- Preserved the loopback-only allowlist. First-party daemon origins and
  configured loopback development origins are allowed; configured non-loopback
  entries remain ignored.
- Added coverage for no-Origin local clients, allowed loopback preflights,
  unsafe preflight rejection, and configured origins.
- Added generated API documentation for local `CORS_ORIGINS` configuration and
  updated the security boundary with the implemented TASK-106 behavior.
- Added a task report at
  `docs/task-reports/2026/06/2026-06-01-task-106-integration-cors-origin-controls/index.html`.
