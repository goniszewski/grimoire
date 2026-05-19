# TASK-055: Daemon Update Check Service

**Phase:** next release distribution polish
**Priority:** medium
**Status:** done

## Summary

Expose the update availability check through the daemon as a read-only API
endpoint, using the same GitHub Releases-compatible parsing and semver
comparison behavior as the packaged `littleimp update check` CLI command.

This is the next low-risk update-system slice after TASK-054. It reports
availability only; it does not download, install, schedule, or roll back
updates.

## Work

1. Extract update-source parsing, channel filtering, and version comparison into
   a shared daemon update service.
2. Keep the existing CLI behavior backed by the shared service.
3. Add `GET /updates/check` with optional `channel` and `source` query
   parameters.
4. Return a `{ data: ... }` response containing current version, applied source,
   applied channel, update availability, and latest compatible release metadata.
5. Add source-of-truth API contract entries and regenerate generated API docs.
6. Update public documentation for the daemon endpoint and current update-system
   scope.

## Acceptance Criteria

- [x] `GET /updates/check` reports whether a newer compatible release exists.
- [x] `channel=stable` ignores prereleases.
- [x] Invalid channels return `422` before contacting the release source.
- [x] Private and loopback `source` hosts return `422` before contacting the
      release source.
- [x] The CLI update check still uses the same release selection behavior.
- [x] API docs and the machine-readable contract include the new endpoint.
- [x] Documentation continues to state that download, install, scheduling, and
      rollback remain future work.

## Completion Notes

- Added shared update logic in `daemon/src/update/service.ts`.
- Added the daemon route in `daemon/src/routes/updates.ts` and registered it in
  the Hono app.
- Updated `daemon/src/cli.ts` to reuse the shared service without changing the
  CLI command surface.
- Updated `daemon/src/api/contract.ts`, regenerated `API.md` and
  `docs/api-contract.json`, and refreshed README/update-system/overview docs.
- Verified the new route and existing CLI behavior with focused Bun tests, then
  ran `bun run check`, `npm run docs:api:check`, `git diff --check`, and the
  full `npm run check` project gate.
