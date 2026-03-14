# TASK-037: Remote Backup — S3-Compatible Target

**Status:** todo
**Priority:** low
**Phase:** M5
**Area:** daemon / frontend

## Description

Extend the backup system from TASK-033 (local snapshots) to support uploading backups to an S3-compatible object storage target (AWS S3, Cloudflare R2, MinIO, etc.).

## Daemon work

### Config additions (`daemon/src/config.ts`)

New optional env vars:
- `BACKUP_S3_ENDPOINT` — custom endpoint URL (for R2/MinIO; omit for AWS)
- `BACKUP_S3_BUCKET`
- `BACKUP_S3_ACCESS_KEY`
- `BACKUP_S3_SECRET_KEY`
- `BACKUP_S3_REGION` (default: `us-east-1`)
- `BACKUP_S3_PREFIX` (default: `little-imp-backups/`)

### S3 upload in `POST /backup`

- If S3 config is present, after writing the local `.zip`:
  - Upload the `.zip` to `s3://<BUCKET>/<PREFIX><filename>` using the AWS SDK v3 (`@aws-sdk/client-s3`)
  - Return additional field `remote_url` in the response (S3 URI, not a presigned URL)
  - Local file is still kept (local backup is always created first)
- If S3 config is absent, skip silently — local-only behavior unchanged

### `GET /backup/list` extension

- Add optional `?include_remote=true` query param
- When set, list objects from the S3 bucket under the prefix
- Merge local and remote entries; mark each with `source: "local" | "remote"`

### `POST /restore` from remote

- Accept `{ source: "remote", key: string }` in addition to the existing `{ path }` form
- Download the zip from S3 to a temp path, then run the existing restore logic
- Clean up temp file after restore

### Unit tests (`daemon/tests/backup-s3.test.ts`)

- Mock S3 client; verify upload called with correct bucket/key
- `GET /backup/list?include_remote=true` merges local + mocked remote entries
- `POST /restore` with `source: "remote"` downloads and restores correctly
- Missing S3 config → remote operations return 422 with clear message

## Frontend work

### Settings page — S3 configuration (`src/pages/Settings.tsx`)

Add a collapsible "Remote Backup (S3)" subsection under Backup & Restore:
- Fields: Endpoint URL (optional), Bucket, Access Key, Secret Key (masked), Region, Prefix
- "Save" persists via `PUT /settings` (extend settings schema)
- "Test connection" button → `POST /settings/test-s3` → success/error toast

### Backup list

- Show remote backups in the existing backup list with a cloud icon
- "Restore from remote" follows the same confirmation dialog flow

## Acceptance Criteria

- [ ] `POST /backup` uploads to S3 when config is present; skips cleanly when absent
- [ ] `GET /backup/list?include_remote=true` returns merged local + remote entries
- [ ] `POST /restore` with `source: "remote"` restores from S3 correctly
- [ ] Invalid/missing S3 config returns 422 with actionable error message
- [ ] Settings page shows S3 config fields; test connection works
- [ ] All new tests pass with mocked S3 client
