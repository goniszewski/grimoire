# TASK-087: Daemon Network Exposure Security Boundaries

**Phase:** Grimoire parity
**Priority:** critical
**Status:** backlog
**Area:** security / daemon
**Source:** PAR-004
**Labels:** grimoire-parity, security, daemon

## Description

Define security boundaries for local integrations while keeping Little Imp
local-first, single-user, and loopback-first.

## Scope

1. Document the current loopback-only threat model for the first-party app and
   local clients.
2. Define the minimum controls for local integration clients: bearer tokens,
   conservative origin policy, secret redaction, and explicit user setup.
3. Document that non-loopback/public-server exposure is out of scope for this
   parity batch.
4. Cover auth, CORS/origin policy, CSRF expectations, local file protections,
   diagnostics redaction, backups, MCP, and update endpoints.
5. Add release checklist gates for any future public-network mode.

## Acceptance Criteria

- [ ] A written threat model exists for loopback first-party use and local
      integration clients.
- [ ] Public-network exposure is documented as out of scope for this batch.
- [ ] Any future non-loopback exposure has explicit auth, origin, and
      data-protection requirements before implementation.
- [ ] Backup, restore, diagnostics, MCP, and update routes are included.
- [ ] Docs state that loopback remains the default secure mode.
- [ ] Release planning blocks public exposure unless these controls are met.

## Dependencies

- Coordinate with TASK-102 and TASK-106.

## Notes

- Do not widen network binding as part of this task.
