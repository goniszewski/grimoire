# TASK-033: Backup & Restore

**Status:** done
**Priority:** medium
**Phase:** M5
**Area:** daemon / frontend

## Description

Implement a snapshot-based backup and restore system. A backup is a portable bundle
containing the SQLite database, a JSON manifest, and a SHA-256 checksum file.
Restore recreates the local data directory from such a bundle.

The initial scope covers local filesystem backup only. S3-compatible remote targets
and scheduled snapshots are deferred to a follow-up task.

## Daemon work

### New route file `daemon/src/routes/backup.ts`

**`POST /backup`**
- Accepts optional `{ destination?: string }` body (absolute path; defaults to
  `DATA_DIR/backups/little-imp-<ISO8601>.zip`)
- Copies the live SQLite database via `VACUUM INTO '<tmpfile>'` to get a clean,
  unlocked snapshot
- Writes a `manifest.json` beside it:
  ```json
  {
    "version": 1,
    "created_at": "<ISO8601>",
    "db_size_bytes": 12345,
    "bookmark_count": 42
  }
  ```
- Packages `snapshot.db` + `manifest.json` into a `.zip` archive using the
  `archiver` or native `Bun.zip` API
- Writes `checksums.sha256` containing SHA-256 of `snapshot.db`
- Returns `{ path, size_bytes, bookmark_count, created_at }`

**`GET /backup/list`**
- Lists `.zip` files in `DATA_DIR/backups/`, newest first
- Returns `[{ filename, path, size_bytes, created_at }]`

**`POST /restore`**
- Accepts `{ path: string }` — absolute path to a backup `.zip`
- Validates: file exists, is a `.zip`, contains `snapshot.db` and `manifest.json`,
  checksum matches
- Stops all active pipeline jobs and the scheduler
- Replaces `DATA_DIR/little-imp.db` with the snapshot
- Restarts the scheduler and job worker
- Returns `{ restored_at, bookmark_count }` or an error object

### Register routes in `daemon/src/server.ts`

### Unit tests (`daemon/tests/backup.test.ts`)
- `POST /backup` creates archive at expected path
- `GET /backup/list` returns the created archive
- `POST /restore` with valid zip restores the db
- `POST /restore` with wrong checksum returns 422

## Frontend work

### Settings page — Backup & Restore section (`src/pages/Settings.tsx`)

Add a new "Backup & Restore" section below existing settings:

**Backup**
- "Create backup now" button → calls `POST /backup`
- Shows last backup path/time on success (or error toast)
- Lists recent backups (`GET /backup/list`) with filename and size

**Restore**
- File picker (`<input type="file" accept=".zip">`) — uploads the zip via
  `POST /restore` as `multipart/form-data` (or as a local path if the file is
  already on the machine)
- Confirmation dialog before restore ("This will overwrite your current library.")
- Shows success/error result

### Hook `src/hooks/use-backup.ts`
- `useCreateBackup()` — mutation wrapping `POST /backup`
- `useBackupList()` — query wrapping `GET /backup/list`
- `useRestore()` — mutation wrapping `POST /restore`

## Acceptance Criteria

- [x] `POST /backup` creates a snapshot directory in `DATA_DIR/backups/` with `snapshot.db`, `manifest.json`, `checksums.sha256`
- [x] `GET /backup/list` returns metadata for existing backups, newest first
- [x] `POST /restore` with a valid backup restores the database (WAL checkpoint + sidecar cleanup)
- [x] `POST /restore` with a tampered snapshot (bad checksum) returns HTTP 422
- [x] `POST /restore` accepts only backup names (no path traversal)
- [x] Settings page shows "Backup & Restore" section with create + restore UI
- [x] Confirmation dialog shown before restore executes
- [x] 13 integration tests pass covering all endpoints, checksum validation, path traversal, and concurrency
