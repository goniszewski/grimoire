# TASK-102: Integration Token Authentication

**Phase:** Grimoire parity
**Priority:** critical
**Status:** backlog
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

- [ ] Loopback browser usage remains usable without unnecessary friction.
- [ ] Existing first-party app API usage remains unchanged.
- [ ] Local integration clients can authenticate with a managed bearer token.
- [ ] Tokens are stored and redacted safely.
- [ ] Auth failures are consistent across protected routes.
- [ ] Daemon tests cover valid, missing, invalid, rotated, and revoked tokens.

## Dependencies

- Depends on security boundary decisions in TASK-087.
