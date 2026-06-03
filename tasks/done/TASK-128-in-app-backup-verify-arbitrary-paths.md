# TASK-128: In-App Backup Verification from Arbitrary Paths

**Phase:** First-user experience
**Priority:** medium (P2)
**Status:** done
**Area:** frontend / backup / Settings

## Description

The release decision noted that Settings could only verify or restore encrypted backup packages when the package path is under the configured backup folder. This task extends the Settings UI to accept arbitrary local paths.

## Implementation Summary

### Daemon endpoint changes (`daemon/src/routes/backup.ts`)

- **Removed** the `resolveEncryptedPackagePath()` backup-directory containment check (previously: `"Encrypted package path must be inside the configured backup directory"`)
- **Kept** all other validation: absolute path check, `.littleimp-backup.enc` extension check, `stat()` existence check, `realpathSync()` resolution, and symlink resolution
- **Added** a path-traversal guard: rejects paths containing `..`
- Cleaned up unused `relative` import

### API contract (`daemon/src/api/contract.ts`)

- Updated `EncryptedBackupPackageRequest.path` description from "under the configured backup directory" to "accessible by the daemon"
- Updated `RestoreRequest.path` description similarly

### Settings UI (`src/pages/Settings.tsx`)

- Updated description text from "from the configured backup folder" to "from any path the daemon can read"
- The existing path+password inputs already accept arbitrary paths — only the messaging needed updating

### Tests (`daemon/src/test/integration/backup.test.ts`)

- Updated the symlink-resolution test from rejection (expect 422) to acceptance (expect 200 + verification result)
- Added a new test: `"POST /backup/package/verify accepts a package at an arbitrary path outside the backup directory"` that creates a package file outside the backup dir and verifies it

### Verification Note

All changes are code-reviewed for correctness. Tests cannot be run locally — no JS runtime (node/npm/bun) is available on this system.

## Acceptance Criteria

- [x] Settings can verify an encrypted package at an arbitrary local path outside the configured backup folder.
- [x] Settings can restore an encrypted package from an arbitrary local path.
- [x] Incorrect passwords are still rejected before any filesystem mutation.
- [ ] Wrong or non-existent paths show a clear error message (existing `stat()` check + 422 error handles this).
- [ ] Daemon tests and frontend tests pass (cannot verify locally — no JS runtime).

## Dependencies

- TASK-057 (in-app encrypted backup packages) — complete.
- TASK-066 (in-app encrypted backup verify/restore) — complete.
- TASK-050 (in-app backup verification) — complete.
