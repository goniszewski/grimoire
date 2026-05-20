# TASK-061: Packaged Upgrade Flow

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
**Area:** update system / installer

## Description

Extend the current read-only update check foundation into a safe manual upgrade
flow for packaged releases. Users should be able to check for an update,
download or point to a verified release artifact, upgrade, and recover using
clear rollback instructions if something fails.

## Scope

1. Define the supported manual upgrade workflow for native installs.
2. Reuse update version parsing and channel filtering from the current update
   service.
3. Download a selected release artifact or accept a local archive path.
4. Verify checksum and signature before upgrade.
5. Stop the running daemon through the existing platform service mechanism.
6. Run the existing upgrade install path from the verified artifact.
7. Restart the daemon and verify `/health` reports the expected version.
8. Surface rollback guidance and retained previous install details on failure.
9. Add CLI and documentation coverage for the supported workflow.

## Acceptance Criteria

- [ ] `littleimp update check` remains read-only unless the user invokes an
      explicit install or upgrade command.
- [ ] A manual packaged upgrade preserves database, settings, backups, and logs.
- [ ] Upgrade refuses artifacts with mismatched checksums or invalid signatures.
- [ ] The daemon is stopped and restarted safely during native upgrades.
- [ ] CLI output clearly reports success, restart status, and rollback guidance.
- [ ] Tests or smoke scripts cover successful upgrade and verification failure.

## Dependencies

- Depends on TASK-059.
- Should coordinate with TASK-060 so installer and upgrader share artifact
  verification logic.

## Notes

- Full automatic updates and background scheduling remain out of scope for MVP.
