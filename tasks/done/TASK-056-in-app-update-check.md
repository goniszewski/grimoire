# TASK-056: In-App Update Check

**Phase:** next release distribution polish
**Priority:** medium
**Status:** done

## Summary

Expose the existing daemon update availability check in the Settings page so
users can manually see whether a newer compatible Little Imp release is
available without using the packaged CLI.

This remains a read-only update-flow slice. It does not download, install,
schedule, or roll back updates.

## Work

1. Add a frontend API client function for `GET /updates/check`.
2. Add an Updates section to Settings with a manual check button.
3. Show the current channel, current version, available release tag, and release
   link returned by the daemon.
4. Add focused Settings coverage for the available-update state.
5. Update task, changelog, and update-system documentation.

## Acceptance Criteria

- [x] Settings can run the daemon-backed update check manually.
- [x] An available compatible release is shown with a release link.
- [x] The UI remains read-only and does not imply install or rollback support.
- [x] Focused frontend tests, browser smoke, and the full project check pass.

## Completion Notes

- Added `checkForUpdates()` to `src/lib/api.ts`.
- Added a read-only Updates section to `src/pages/Settings.tsx`.
- Added focused coverage in `src/pages/Settings.test.tsx`.
- Updated README, roadmap, PRD, update-system docs, changelog, and task index
  to reflect the in-app manual check.
- Fixed review findings by hardening the external release link and extending
  frontend API contract coverage for the update-check result alias.
- Verified with
  `npm test -- src/pages/Settings.test.tsx src/lib/api-contract.test.ts`,
  `npx tsc --noEmit`, `npm run check`, `git diff --check`, and a browser smoke
  against `/settings`.
