# TASK-044: Make Backup and Restore Safe and Match the Design

**Status:** done
**Priority:** high
**Phase:** v0-beta hardening
**Area:** daemon, backup, restore, docs

## Description

The backup design requires a portable backup that includes durable settings and a restore flow that stops writes, validates compatibility, creates rollback data, and restarts cleanly. Before this task, the implementation created a directory containing `snapshot.db`, `manifest.json`, and `checksums.sha256`, then restored by copying over the live SQLite file while the daemon was still running and reporting `restart_required`.

This task closes the gap between the design and behavior before backup/restore is treated as release-ready.

## Progress

- Release format is documented as the implemented snapshot directory, not an archive bundle.
- Backups now include `snapshot.db`, `manifest.json`, `checksums.sha256`, and `data/settings.json`.
- `data/settings.json` includes durable non-secret settings and deliberately omits API keys, lock PIN hashes, and S3 credentials.
- Restore requires checksums by default, validates manifest compatibility, creates rollback data, runs migrations on a temporary restored database, closes the live database handle, and returns `restart_required`.
- Local and remote restore paths both verify required checksum and manifest files before replacement.

## Dependencies / sequencing

- This is a data-integrity blocker and should land before release documentation is reconciled in TASK-047.
- Coordinate with TASK-041 so persisted settings are included or intentionally excluded by a documented secrets policy.

## Work

1. [x] Decide whether the release format is the implemented snapshot directory or the designed archive bundle; update design/docs accordingly.
2. [x] Define the settings backup policy: include non-secret durable settings by default, and either omit secrets or export them only through an explicit protected-backup flow.
3. [x] Include durable settings in backups according to that policy, including AI provider/model settings and backup schedule/destination settings.
4. [x] Add manifest fields for app version, schema version, backup format version, included files, checksum algorithm, settings presence, and compatibility.
5. [x] Require checksum verification for local and remote restore unless the user explicitly chooses an unsafe recovery path.
6. [x] Add a restore maintenance path that closes the live SQLite handle before replacing the database and requires restart before further use.
7. [x] Create a timestamped rollback copy before replacing the live data.
8. [x] Run migrations after restore when restoring an older compatible schema.
9. [x] Update Settings UI and docs to communicate restart/maintenance requirements precisely.

## Acceptance Criteria

- [x] A backup contains the database, manifest, checksums, and durable settings according to the documented secrets policy.
- [x] Restore refuses unsupported backup format or newer schema versions.
- [x] Restore verifies checksums before replacing local data, including remote restores.
- [x] Restore pauses writes or runs outside the live daemon process.
- [x] Restore creates a rollback copy before replacement.
- [x] Restore returns clear status for success, rollback path, and restart requirements.
- [x] Integration tests cover successful restore, corrupt checksum, unsupported format, settings restore, and rollback creation.
- [x] README and `docs/backup-design.md` match the implemented behavior.

## Completion Notes

Implemented safe local and remote backup restore behavior with manifest compatibility validation, required checksum verification, durable non-secret settings backup, rollback copy creation, restore-time migrations, live database handle closure before replacement, and clear restart/rollback status in the API and Settings UI.

Additional review hardening prevents incomplete local or S3 backup payloads from appearing restorable, uploads S3 snapshots last to reduce exposure of partial backups, validates manifest payload paths, and replaces the live database through a same-directory temporary file before atomic rename.

Verification passed for `npm test`, `bun test` in `daemon/`, root `npx tsc --noEmit`, targeted backup integration tests, and `git diff --check`. The daemon `bun run check` quality gate is still blocked by pre-existing TASK-043 pipeline test typing issues around Bun `fetch.preconnect` mocks and one `string | undefined` assertion.
