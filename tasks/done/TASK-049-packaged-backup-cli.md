# TASK-049: Packaged Backup CLI Commands

**Phase:** next release operations  
**Priority:** medium  
**Status:** done

## Summary

Add a packaged `littleimp` command that exposes backup operations from the shell:

- `littleimp backup create`
- `littleimp backup list`
- `littleimp backup restore`
- `littleimp backup verify`

The CLI should use the existing local daemon API for operations that mutate daemon state and should validate local snapshot directories without restoring them for `backup verify`.

## Acceptance Criteria

- [x] `backup create` calls the existing daemon `POST /backup` endpoint and reports snapshot metadata.
- [x] `backup list` calls `GET /backup/list`, with an option to include remote backups.
- [x] `backup restore` calls `POST /restore` and requires explicit confirmation.
- [x] `backup verify` validates a local snapshot directory, manifest, and checksums without replacing local data.
- [x] The installer exposes the packaged CLI command.
- [x] README documents the backup CLI commands.
- [x] Focused CLI tests and daemon type checks pass.
