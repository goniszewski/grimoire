# TASK-138: Trustworthy Browser Capture Flow

**Phase:** Product reset and public beta
**Priority:** critical (P0)
**Status:** todo
**Area:** capture / frontend / daemon / security

## Description

Make one-click capture honest and reliable. The current bookmarklet performs a
state-changing GET with a query-string token and reports `Saved!` after a timer
without observing the daemon response.

## Scope

1. Replace the state-changing GET design with a capture transport that preserves
   explicit authentication and safe HTTP semantics.
2. Remove bearer tokens from request URLs and avoid token exposure through
   history, logs, referrers, or copied error output.
3. Return a verifiable success/error result to the bookmarklet, for example via
   a constrained `postMessage` handshake.
4. Show success only after confirmed daemon success; distinguish duplicates,
   invalid/private URLs, revoked tokens, daemon offline, and timeouts.
5. Consolidate the duplicate bookmarklet source files into one implementation.
6. Verify Chrome, Firefox, Safari, and Edge behavior or document a deliberately
   narrower supported-browser matrix.
7. Update capture API contracts, generated docs, README guidance, and tests.

## Acceptance Criteria

- [ ] Capture uses non-GET mutation semantics and does not place tokens in URLs.
- [ ] The bookmarklet never reports success without a confirmed daemon result.
- [ ] Offline, timeout, revoked-token, duplicate, and validation outcomes are visible and accurate.
- [ ] Only one bookmarklet source implementation remains.
- [ ] Focused daemon/frontend tests and the supported-browser validation matrix pass.

## Dependencies

- None. Coordinate dependency changes with TASK-137 if both touch capture middleware.

## Notes

- This is a core product journey and a public-beta gate, not optional polish.
