# Little Imp Backup Design

Version: v0.1
Status: Draft
Author: Robert Goniszewski
Date: March 2026

---

## 1. Purpose

This document defines the concrete backup and restore design for Little Imp.

Backup is designed as:

- portable snapshot export
- restorable on a different machine
- independent from sync
- compatible with local folders and remote object storage

The design assumes Little Imp remains a single-user, local-first application.

---

## 2. Goals

Primary goals:

1. Preserve all user data required to fully restore Little Imp.
2. Make restore safe, explicit, and deterministic.
3. Support local backups first, then remote backups without changing the backup format.
4. Keep cloud-provider support narrow by using a destination abstraction.
5. Avoid turning backup into live sync.

---

## 3. Non-Goals

This design does not attempt to provide:

- live multi-device synchronization
- collaborative editing
- point-in-time replication of a running remote database
- provider-specific integrations for every consumer cloud drive
- partial in-place restore into an already-running data directory

---

## 4. Backup Scope

A backup must include all data required to recreate a functional Little Imp library.

Initial required contents:

- SQLite database file
- `settings.json` as the durable settings source
- backup manifest
- checksums file

Optional contents:

- extracted attachments if future versions store them outside SQLite
- logs for support/debug export only, not required for restore

Explicitly excluded:

- transient caches that can be rebuilt
- PID files, lock files, sockets
- temporary import files

---

## 5. Data Model Assumptions

The backup system assumes:

- the SQLite database is the source of truth for bookmarks, tags, categories, suggestions, jobs, embeddings, and timeline
- the application has a single writable local data directory (`DATA_DIR`)
- restore creates a new local data directory from backup artifacts

If future versions move durable data outside SQLite, those files must be added to the bundle manifest and checksum list.

---

## 6. Backup Format

### 6.1 Bundle

Backup artifact filename:

`little-imp-backup-YYYYMMDDTHHMMSSZ.tar.zst`

Example:

`little-imp-backup-20260313T183500Z.tar.zst`

Compression:

- `tar` archive
- `zstd` compression

Rationale:

- portable across platforms
- simple to inspect manually
- efficient enough for SQLite snapshots

### 6.2 Archive layout

```text
little-imp-backup/
  manifest.json
  checksums.txt
  data/
    littleimp.db
    settings.json
    attachments/
```

Notes:

- `attachments/` may be absent if unused
- file names inside the archive are stable and versioned by the manifest, not by path guessing

### 6.3 Manifest schema

`manifest.json`

```json
{
  "backup_format_version": 1,
  "created_at": "2026-03-13T18:35:00Z",
  "app": {
    "name": "little-imp",
    "version": "0.1.0"
  },
  "database": {
    "filename": "data/littleimp.db",
    "schema_version": 8
  },
  "settings": {
    "filename": "data/settings.json",
    "present": true
  },
  "attachments": {
    "path": "data/attachments",
    "present": false
  },
  "integrity": {
    "checksum_algorithm": "sha256",
    "checksums_file": "checksums.txt"
  }
}
```

Manifest requirements:

- `backup_format_version` is required and governs restore compatibility
- `created_at` must be UTC ISO-8601
- `app.version` is the creating app version
- `database.schema_version` must match the migration state at backup time
- every durable payload included in the archive must be represented either directly in the manifest or by convention documented in this spec

### 6.4 Checksums

`checksums.txt` uses SHA-256 with one entry per payload file.

Example:

```text
<sha256>  manifest.json
<sha256>  data/littleimp.db
<sha256>  data/settings.json
```

Rules:

- the checksum file must include all restorable payload files
- the checksum file must not include itself
- restore must verify checksums before replacing local data

---

## 7. Snapshot Creation

### 7.1 Snapshot semantics

Little Imp must never back up a live database file by copying it blindly while writes are in progress.

The system must create a consistent snapshot first.

Preferred approach:

1. pause writes for the shortest practical window or enter maintenance mode for backup
2. create a SQLite-consistent snapshot copy
3. copy settings and other durable files into a staging directory
4. write manifest and checksums
5. archive and compress the staging directory
6. send the final artifact to the chosen destination

Implementation note:

- use SQLite backup-safe mechanisms rather than raw file copying where possible
- create the archive from a staging directory under the same machine, not directly from the live data directory

### 7.2 Local staging path

Temporary backup staging path:

`<DATA_DIR>/tmp/backups/<backup-id>/`

Temporary artifacts must be deleted after success.

On failure, temporary artifacts may be retained for debugging but must not be mistaken for completed backups.

### 7.3 Backup ID

Backup ID format:

`bkp_<timestamp>_<random>`

Example:

`bkp_20260313T183500Z_4f8c2a91`

This ID is used for logs, manifests, and destination metadata.

---

## 8. Restore Semantics

### 8.1 Safety model

Restore is explicit and destructive with respect to the target local data directory.

The app must not restore over a running instance without:

- stopping background workers
- stopping writes
- clearly warning the user

Preferred restore flow:

1. select backup artifact
2. extract to temporary directory
3. validate manifest version
4. validate checksums
5. validate minimum compatibility rules
6. stop daemon or enter maintenance mode
7. move current data directory to a timestamped rollback location
8. copy restored files into a fresh local data directory
9. run migrations if required and supported
10. start daemon
11. report success or provide rollback instructions

### 8.2 Compatibility rules

Restore must reject backups when:

- `backup_format_version` is newer than the current app understands
- required files are missing
- checksums do not match
- the archive is malformed

Restore may proceed with migration when:

- backup format is supported
- schema version is older than or equal to the current app
- the app has migrations capable of upgrading the restored database

Restore policy:

- backward restore compatibility is required within the same major backup format
- restoring from newer app data into an older binary is not guaranteed

### 8.3 Rollback

Before replacing local data, the restore flow must create:

`<DATA_DIR>.pre-restore-YYYYMMDDTHHMMSSZ`

If restore fails after local replacement starts, the app should attempt automatic rollback from this directory.

---

## 9. Destination Abstraction

Backup creation and restore use one portable bundle format regardless of destination.

Destination interface:

- `put(local_artifact_path, remote_key_or_target)`
- `get(remote_key_or_target, local_output_path)`
- `list(prefix_or_target)`
- `delete(remote_key_or_target)`
- `healthcheck()`

Destination types:

1. local folder
2. S3-compatible object storage

Deferred destination types:

- provider-specific Google Drive API
- provider-specific Dropbox API
- provider-specific OneDrive API

### 9.1 Local folder destination

Behavior:

- copy completed backup bundle into a user-selected local path
- support removable drives and cloud-synced folders because they appear as normal filesystem paths

Examples:

- external disk
- iCloud Drive folder
- Dropbox folder
- Google Drive synced folder
- OneDrive synced folder

### 9.2 S3-compatible destination

Required configuration:

- endpoint
- bucket
- region if required by provider
- access key ID
- secret access key
- optional prefix

Expected compatible providers:

- Amazon S3
- Cloudflare R2
- MinIO
- Backblaze B2 S3-compatible endpoints

Rules:

- uploads must be atomic from the application point of view: only completed artifacts are listed as available backups
- large uploads should use multipart upload if artifact size warrants it
- object keys should include date-based prefixes for easy retention management

Example object key:

`little-imp/backups/2026/03/13/little-imp-backup-20260313T183500Z.tar.zst`

---

## 10. Scheduling and Retention

### 10.1 Manual backup

The first implementation must support:

- "Create backup now"
- destination selection
- success/failure reporting

### 10.2 Scheduled backup

Later implementation should support:

- daily schedule
- weekly schedule
- configurable retention count

Recommended defaults:

- local snapshots: keep last 14
- remote snapshots: keep last 30

Retention deletion must apply only to completed backups that pass manifest validation.

### 10.3 Naming and ordering

Backups are ordered by `created_at` from the manifest, not by filesystem mtime alone.

---

## 11. Security

Rules:

- backup credentials are stored locally only
- secrets must never be written into backup manifests
- checksums protect integrity, not confidentiality
- password-based encryption is optional but supported by the backup format

Encryption policy:

- encryption wraps the final backup artifact rather than changing the internal portable layout
- the same manifest schema and archive layout remain valid before encryption
- password material must never be stored in the manifest, checksums file, or destination metadata
- the restore flow must clearly distinguish "wrong password" from "corrupt backup" where possible

Recommended encrypted artifact naming:

`little-imp-backup-YYYYMMDDTHHMMSSZ.tar.zst.enc`

Initial encryption UX:

- the user may choose to protect a backup with a password
- the password is requested at backup creation time
- the password must be re-entered for restore
- the app must warn clearly that a forgotten password makes the encrypted backup unusable

---

## 12. Failure Handling

Backup must fail loudly and preserve the current local library.

Failure cases:

- snapshot creation fails
- manifest creation fails
- checksum mismatch before upload
- destination unavailable
- upload interrupted

Rules:

- no partial restore should replace a healthy local data directory
- incomplete backup uploads must not appear as completed backups
- user-visible error reporting must distinguish local snapshot failure from destination failure

---

## 13. UI Requirements

Initial UI surface:

- backup section in Settings
- "Create backup now"
- destination configuration
- backup history list
- "Restore from backup" entry point with warning dialog

Initial CLI surface:

- `littleimp backup create`
- `littleimp backup list`
- `littleimp backup restore`
- `littleimp backup verify`

Restore confirmation must communicate:

- target local data will be replaced
- current data will be moved to a rollback directory first
- backup compatibility checks run before replacement

---

## 14. Phased Delivery

### Phase 1

- define backup bundle format
- implement local snapshot creation
- implement local restore
- expose manual backup and restore in both UI and CLI
- document manual backup and restore

### Phase 2

- add scheduled local backups
- add retention policy
- add backup history UI

### Phase 3

- add S3-compatible destination
- add remote backup listing and restore download

### Phase 4

- refine password-based encryption UX and verification tooling
- consider provider-specific cloud APIs only if folder-based workflows are insufficient

---

## 15. Implementation Notes

Recommended internal modules:

- `backup/manifest.ts`
- `backup/checksums.ts`
- `backup/snapshot.ts`
- `backup/archive.ts`
- `backup/encryption.ts`
- `backup/restore.ts`
- `backup/destinations/local-folder.ts`
- `backup/destinations/s3.ts`

Recommended API surface:

- `POST /backups`
- `GET /backups`
- `POST /backups/restore`
- `GET /backups/destinations/health`

Recommended CLI surface:

- `littleimp backup create --destination <target>`
- `littleimp backup create --destination <target> --encrypt`
- `littleimp backup list`
- `littleimp backup restore --file <artifact>`
- `littleimp backup verify --file <artifact>`

The exact route names may change, but the implementation should keep backup creation, listing, and restore as separate operations.

---

## 16. Resolved Decisions

Resolved implementation decisions:

1. `settings.json` is the correct durable settings source and must be included in every backup.
2. Backup and restore must be available in both UI and CLI.
3. Optional password-based encryption is in scope and supported by the backup format.
4. A short maintenance window during backup or restore is acceptable.

Operational note:

- scheduled backups may briefly enter maintenance mode to obtain a consistent snapshot
- restore always requires an explicit user-triggered operation
