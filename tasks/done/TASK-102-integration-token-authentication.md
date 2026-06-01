# TASK-102: Integration Token Authentication

**Phase:** Grimoire parity
**Priority:** critical
**Status:** done
**Area:** daemon / security / integrations
**Source:** PAR-021
**Labels:** grimoire-parity, security, api, integrations

## Description

Add pragmatic integration-token authentication for local API clients while
preserving the existing first-party loopback app behavior.

## Scope

1. Define when token auth is required for documented local integration clients
   and when trusted first-party loopback browser use remains unchanged.
2. Add token generation, storage, rotation, revocation, and redaction behavior.
3. Do not require the existing first-party frontend to obtain or send a token as
   part of this task.
4. Require tokens for documented local integration/client flows and any future
   integration-specific routes.
5. Document auth failure responses and client usage examples.

## Acceptance Criteria

- [x] Loopback browser usage remains usable without unnecessary friction.
- [x] Existing first-party app API usage remains unchanged.
- [x] Local integration clients can authenticate with a managed bearer token.
- [x] Tokens are stored and redacted safely.
- [x] Auth failures are consistent across protected routes.
- [x] Daemon tests cover valid, missing, invalid, rotated, and revoked tokens.

## Dependencies

- Depends on security boundary decisions in TASK-087.

## Work Notes

- June 1, 2026: Implemented scoped local integration-token auth for TASK-102.
- Added append-only migration `0015_integration_tokens.sql`, a token
  repository that stores SHA-256 token hashes and redacted prefixes only,
  token create/list/rotate/revoke routes, MCP bearer-token enforcement, and
  optional bearer validation for regular REST routes when clients present an
  `Authorization` header.
- Review follow-up hardened token creation by applying the local JSON body-size
  guard and rejecting declared non-JSON request bodies with `415`.
- Preserved first-party loopback browser behavior: existing app routes remain
  usable without sending tokens.
- Regenerated `API.md` and `docs/api-contract.json`, updated MCP setup docs,
  Docker/security/overview/parity/release-decision docs, and recorded the
  change in
  `docs/task-reports/2026/06/2026-06-01-task-102-integration-token-auth/`.
- Focused auth verification passed with
  `bun test src/test/integration/integration-token-auth.test.ts`, focused
  migration coverage passed, `npm run docs:api:check` passed, and
  `npm run check` passed with existing warnings only.
