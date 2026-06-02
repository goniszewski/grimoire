# TASK-128: In-App Backup Verification from Arbitrary Paths

**Phase:** First-user experience
**Priority:** medium (P2)
**Status:** todo
**Area:** frontend / backup / Settings

## Description

The release decision notes that Settings can currently verify or restore encrypted backup packages only when the package path is under the configured backup folder. The packaged CLI (`littleimp backup package verify` / `littleimp backup package restore`) works with arbitrary local paths. Extend the Settings UI to accept an arbitrary local path so users can verify and restore packages stored anywhere on the filesystem without dropping to the CLI.

## Scope

1. **Extend the Settings Backup section:**
   - Add a "Verify package from path..." button below the existing backup package list
   - Opens a text input for the user to type or paste a local filesystem path to an encrypted `.littleimp-encrypted` package file
   - Password prompt same as existing package verify flow
   - Calls the existing verify/restore endpoints with the user-provided path
   - Show success/failure result inline

2. **Daemon endpoint changes:**
   - Review `POST /backup/package/verify` and `POST /restore` to confirm they accept arbitrary paths when `source: "encrypted_package"` is used with a `package_path` field
   - If path validation is too restrictive (refuses paths outside the configured backup dir), update the route to allow any path the daemon process can read

3. **Tests:**
   - Daemon tests for the relaxed verify/restore path acceptance
   - Frontend tests for the new Settings UI section
   - Manual test: create an encrypted package, move it outside the backup folder, verify and restore from the new Settings path input

## Acceptance Criteria

- [ ] Settings can verify an encrypted package at an arbitrary local path outside the configured backup folder.
- [ ] Settings can restore an encrypted package from an arbitrary local path.
- [ ] Incorrect passwords are still rejected before any filesystem mutation.
- [ ] Wrong or non-existent paths show a clear error message.
- [ ] Daemon tests and frontend tests pass.

## Dependencies

- TASK-057 (in-app encrypted backup packages) — complete.
- TASK-066 (in-app encrypted backup verify/restore) — complete.
- TASK-050 (in-app backup verification) — complete.

## Notes

- This closes a documented limitation from the MVP release decision. The CLI already works; this brings the Settings UI to parity.
- Ensure the daemon path validation does a real `stat()` existence check before attempting verify/restore, and rejects paths that escape the data directory via `..` traversal.
