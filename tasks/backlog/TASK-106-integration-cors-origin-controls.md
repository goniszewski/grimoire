# TASK-106: Integration CORS And Origin Controls

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Default origin policy remains conservative.
- [ ] Approved integration origins can be configured deliberately.
- [ ] Unsafe origins are rejected with clear behavior.
- [ ] Docs include local client configuration examples and explicitly omit
      extension/bookmarklet examples for this batch.
- [ ] Tests cover allowed, missing, unsafe, and configured origins.

## Dependencies

- Depends on TASK-087 and coordinates with TASK-102.
