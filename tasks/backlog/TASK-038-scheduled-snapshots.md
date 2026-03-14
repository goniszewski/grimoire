# TASK-038: Scheduled Local Snapshots with Retention Policy

**Status:** todo
**Priority:** low
**Phase:** M5
**Area:** daemon / frontend

## Description

Automatically create local backup snapshots on a schedule and enforce a retention policy to prevent unbounded disk growth. Builds on the backup infrastructure from TASK-033.

## Daemon work

### Config additions (`daemon/src/config.ts`)

New optional env vars:
- `BACKUP_SCHEDULE_ENABLED` — `true` | `false` (default: `false`)
- `BACKUP_SCHEDULE_CRON` — cron expression (default: `0 3 * * *` — daily at 3 AM)
- `BACKUP_RETENTION_COUNT` — max number of local backups to keep (default: `7`)

### Scheduler integration (`daemon/src/scheduler.ts`)

- Register a named task `"backup-snapshot"` when `BACKUP_SCHEDULE_ENABLED=true`
- Task calls the same logic as `POST /backup` (extract to shared function)
- After creating the new backup, apply retention: sort backups by `created_at` descending, delete oldest files beyond `BACKUP_RETENTION_COUNT`

### `GET /backup/schedule` (new route)

- Returns current schedule config: `{ enabled, cron, retention_count, next_run_at }`

### `PUT /backup/schedule` (new route)

- Accepts `{ enabled, cron, retention_count }`
- Validates cron expression (basic: non-empty, 5-part)
- Persists to settings table
- Restarts scheduler task with new interval if already running

### Unit tests (`daemon/tests/backup-schedule.test.ts`)

- Scheduler registers task when enabled
- Retention: after creating N+1 backups, oldest is deleted
- `GET /backup/schedule` returns correct next run time
- `PUT /backup/schedule` with invalid cron returns 422

## Frontend work

### Settings page — Schedule subsection

Add under "Backup & Restore":
- Toggle: "Automatic daily snapshots"
- When enabled, show: schedule selector (daily / weekly / custom cron) and retention count input
- "Next backup:" timestamp display
- "Save schedule" button

## Acceptance Criteria

- [ ] Snapshot job runs on schedule when enabled
- [ ] Retention policy deletes oldest backups beyond configured count
- [ ] `GET /backup/schedule` returns accurate `next_run_at`
- [ ] `PUT /backup/schedule` with invalid cron returns 422
- [ ] Settings UI lets user enable/configure schedule
- [ ] All tests pass
