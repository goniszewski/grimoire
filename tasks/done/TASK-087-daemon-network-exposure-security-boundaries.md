# TASK-087: Daemon Network Exposure Security Boundaries

**Phase:** Grimoire parity
**Priority:** critical
**Status:** done
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

- [x] A written threat model exists for loopback first-party use and local
      integration clients.
- [x] Public-network exposure is documented as out of scope for this batch.
- [x] Any future non-loopback exposure has explicit auth, origin, and
      data-protection requirements before implementation.
- [x] Backup, restore, diagnostics, MCP, and update routes are included.
- [x] Docs state that loopback remains the default secure mode.
- [x] Release planning blocks public exposure unless these controls are met.

## Dependencies

- Coordinate with TASK-102 and TASK-106.

## Notes

- Do not widen network binding as part of this task.

## Work Notes

- May 31, 2026: Selected as the next logical actionable task because
  TASK-078 and TASK-079 remain blocked on public artifact visibility,
  TASK-080 remains blocked by the shared daemon occupying
  `127.0.0.1:3210`, and TASK-087 is the first critical backlog item in the
  Grimoire parity batch.
- Added `docs/security-boundaries.md` as the canonical threat model for the
  loopback-first daemon, first-party UI, explicit local clients, MCP, backups,
  diagnostics, Settings, updates, local file boundaries, and future
  public-network release gates.
- Updated `SECURITY.md`, `docs/overview.md`, and
  `docs/release-checklist.md` so release planning blocks direct public
  exposure unless the documented gates are complete.
- Updated the parity worksheet and parity report to mark PAR-004/TASK-087
  complete and point future public-network reconsideration to the canonical
  security-boundary document.
- May 31, 2026 review: tightened the local-process threat wording so loopback
  access is described as any same-machine process that can reach the daemon,
  then verified the docs and implementation checks with `npm run check`,
  focused daemon security tests, `npm run docs:api:check`, link checks, and
  `git diff --check`.
