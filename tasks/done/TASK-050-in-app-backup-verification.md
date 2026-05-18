# TASK-050: In-App Backup Verification UX

**Phase:** next release operations
**Priority:** medium
**Status:** done

## Summary

Add an in-app way to verify an existing local backup snapshot without restoring it. This reuses the current portable backup checks: manifest validation, checksum validation, and backed-up settings presence where required.

## Acceptance Criteria

- [x] The daemon exposes a local backup verification endpoint that accepts a backup name and does not replace the live database.
- [x] Verification rejects invalid backup names, missing files, unsupported manifests, and checksum mismatches.
- [x] The frontend API contract and generated docs include the verification request and response.
- [x] The Settings backup list includes a verify action for local backups.
- [x] Verification success and failure are surfaced through existing toast feedback.
- [x] Focused daemon and frontend tests pass.
