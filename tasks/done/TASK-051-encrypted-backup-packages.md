# TASK-051: Encrypted Backup Packages

**Phase:** next release operations
**Priority:** medium
**Status:** done

## Summary

Add an optional encrypted backup package flow to the packaged `littleimp` CLI. The encrypted package wraps the existing portable snapshot directory format so restore and verification continue to use the current manifest and checksum rules.

## Acceptance Criteria

- [x] `littleimp backup create --encrypt --output <file>` creates a normal local snapshot through the daemon and writes an encrypted package from it.
- [x] Encrypted package creation skips remote S3 upload so a local packaging operation does not create an unencrypted remote copy.
- [x] `littleimp backup verify --encrypted --file <file>` decrypts to a temporary directory and verifies the snapshot without restoring it.
- [x] `littleimp backup restore --encrypted-file <file> --yes` decrypts into the daemon backup destination, calls the existing restore API, and removes the temporary decrypted snapshot directory.
- [x] Passwords come from `LITTLEIMP_BACKUP_PASSWORD` or `--password-file` and are not stored in the package manifest, snapshot manifest, checksums, or destination metadata.
- [x] Focused package, CLI, and S3 tests pass.
