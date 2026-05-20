# TASK-057: In-App Encrypted Backup Packages

**Phase:** next release operations
**Priority:** medium
**Status:** done

## Summary

Expose encrypted backup package creation in Settings for existing local backup
snapshots. The encrypted package wraps the existing portable snapshot directory
format and uses the same password-based package implementation as the packaged
`littleimp` CLI.

## Work

1. Add a daemon endpoint for packaging an existing local backup by name.
2. Add source-of-truth API contract coverage for the new package request and
   response.
3. Add a frontend API client and backup hook for encrypted package creation.
4. Add a password-confirmed Settings action on local backup rows.
5. Update task, roadmap, PRD, backup, changelog, and generated API docs.

## Acceptance Criteria

- [x] Settings can create an encrypted package from a listed local backup.
- [x] Passwords are required per package request and are not stored in settings.
- [x] The daemon writes the package beside the configured backup directory using
      the existing encrypted package format.
- [x] Focused daemon, frontend, and API contract tests cover the new behavior.

## Completion Notes

- Added `POST /backup/package` to the daemon backup route.
- Added `createEncryptedBackupPackage()` to the frontend API client and
  `useCreateEncryptedBackupPackage()` to backup hooks.
- Added a password-confirmed encrypted package action to Settings backup rows.
- Hardened package and verify request handling so non-object JSON returns `400`
  and failed package input verification returns `422`.
- Verified focused coverage with
  `cd daemon && bun test src/test/integration/backup.test.ts` and
  `npm test -- src/pages/Settings.test.tsx src/lib/api-contract.test.ts`.
- Verified the final change set with `npx tsc --noEmit`, `git diff --check`,
  and `npm run check`.
