# TASK-039: Custom Backup Destination (Cloud-Synced Folders)

**Status:** done
**Priority:** low
**Phase:** M5
**Area:** daemon / frontend

## Description

Allow users to configure a custom local folder as the backup destination. This enables backing up to
cloud-synced folders (iCloud Drive, Dropbox, Google Drive, OneDrive) without any provider-specific
API — the OS sync client handles uploading once the file lands in the folder.

Default behaviour is unchanged: backups still go to `DATA_DIR/backups/` when no custom path is set.

## Daemon work

### Settings schema (`daemon/src/settings.ts`)

Add `backup.local.destination_path` (string, default `""`):
- Empty string = use `DATA_DIR/backups/` (current behaviour)
- Non-empty = write backups to this absolute path (created on first use)

### Validation (`validateSettingsPatch`)

- `backup.local.destination_path` must be a string
- If non-empty: must be an absolute path (starts with `/`)
- Path-traversal characters (`..`) are rejected

### Route changes (`daemon/src/routes/backup.ts`)

- `resolvedBackupsDir` uses the custom path when `settings.backup.local.destination_path` is set
- `POST /backup`, `GET /backup/list`, `POST /restore` all use the resolved dir (no other changes needed
  — they already receive `resolvedBackupsDir` as a parameter or closure variable)

### `GET /backup/destination` (new route)

Returns `{ path: string; is_custom: boolean; writable: boolean }`:
- `path` — the resolved backups directory (absolute path)
- `is_custom` — true when `destination_path` is set
- `writable` — result of probing the directory for write access

### `PUT /backup/destination` (new route)

Body: `{ path: string }` (empty string resets to default)
- Validates path is absolute (or empty)
- Probes write access by creating and removing a temp file
- Persists to settings

### Unit tests (`daemon/src/test/integration/backup-destination.test.ts`)

- Default path resolves to `DATA_DIR/backups/`
- Custom path is used for `POST /backup` and `GET /backup/list`
- `PUT /backup/destination` with relative path returns 422
- `PUT /backup/destination` with `""` resets to default
- `GET /backup/destination` returns correct `is_custom` and `writable`

## Frontend work

### Settings page — Backup Destination subsection

Under "Backup & Restore", add before the Schedule subsection:
- Label: "Backup folder"
- Input: path text field (placeholder: default path shown grayed out)
- Helper text: "Point to a cloud-synced folder (iCloud Drive, Dropbox, etc.) to back up automatically"
- "Browse…" button: opens `<input type="file" webkitdirectory>` and fills the path
- Current path shown; "writable" check shown as a green/red indicator
- "Save" button calls `PUT /backup/destination`

### Hook (`src/hooks/use-backup.ts`)

Add `useBackupDestination` and `useUpdateBackupDestination` hooks.

## Acceptance Criteria

- [x] Default path (`DATA_DIR/backups/`) is used when no custom path configured
- [x] Custom path used for backup creation and listing
- [x] `PUT /backup/destination` with non-absolute path returns 422
- [x] `PUT /backup/destination` with `""` resets to default
- [x] `GET /backup/destination` returns `writable: true` for accessible dirs
- [x] Settings UI lets user set and clear the backup folder
- [x] All new tests pass
