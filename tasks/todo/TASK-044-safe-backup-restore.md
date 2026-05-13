# TASK-044: Make Backup and Restore Safe and Match the Design

**Status:** todo
**Priority:** high
**Phase:** v0-beta hardening
**Area:** daemon, backup, restore, docs

## Description

The backup design requires a portable backup that includes durable settings and a restore flow that stops writes, validates compatibility, creates rollback data, and restarts cleanly. The implementation currently creates a directory containing `snapshot.db`, `manifest.json`, and `checksums.sha256`, then restores by copying over the live SQLite file while the daemon is still running and reporting `restart_required`.

This task closes the gap between the design and behavior before backup/restore is treated as release-ready.

## Current evidence

- `createBackupSnapshot()` uses `VACUUM INTO` for a database snapshot, which is good, but emits a directory format rather than the archive bundle described in `docs/backup-design.md`.
- The manifest currently contains basic fields such as `version`, `created_at`, `bookmark_count`, and `db_size_bytes`, but not app version, schema version, format compatibility, included files, or settings metadata.
- Local and remote backup paths upload/copy `snapshot.db` and `checksums.sha256`; durable settings are not part of the restorable payload.
- Restore can proceed without checksum verification when a checksum file is missing.
- Restore replaces the live database with `copyFileSync()` inside the running daemon and does not create a rollback copy first.

## Dependencies / sequencing

- This is a data-integrity blocker and should land before release documentation is reconciled in TASK-047.
- Coordinate with TASK-041 so persisted settings are included or intentionally excluded by a documented secrets policy.

## Work

1. Decide whether the release format is the implemented snapshot directory or the designed archive bundle; update design/docs accordingly.
2. Define the settings backup policy: include non-secret durable settings by default, and either omit secrets or export them only through an explicit protected-backup flow.
3. Include durable settings in backups according to that policy, including AI provider/model settings and backup schedule/destination settings.
4. Add manifest fields for app version, schema version, backup format version, included files, checksum algorithm, settings presence, and compatibility.
5. Require checksum verification for local and remote restore unless the user explicitly chooses an unsafe recovery path.
6. Add a maintenance mode or restore command path that stops workers, scheduler jobs, and writes before replacing the database.
7. Create a timestamped rollback copy before replacing the live data.
8. Run migrations after restore when restoring an older compatible schema.
9. Update Settings UI and docs to communicate restart/maintenance requirements precisely.

## Acceptance Criteria

- [ ] A backup contains the database, manifest, checksums, and durable settings according to the documented secrets policy.
- [ ] Restore refuses unsupported backup format or newer schema versions.
- [ ] Restore verifies checksums before replacing local data, including remote restores.
- [ ] Restore pauses writes or runs outside the live daemon process.
- [ ] Restore creates a rollback copy before replacement.
- [ ] Restore returns clear status for success, rollback path, and restart requirements.
- [ ] Integration tests cover successful restore, corrupt checksum, unsupported format, settings restore, and rollback creation.
- [ ] README and `docs/backup-design.md` match the implemented behavior.
