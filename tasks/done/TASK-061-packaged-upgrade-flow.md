# TASK-061: Packaged Upgrade Flow

**Phase:** MVP readiness
**Priority:** high
**Status:** done
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

- [x] `littleimp update check` remains read-only unless the user invokes an
      explicit install or upgrade command.
- [x] A manual packaged upgrade preserves database, settings, backups, and logs.
- [x] Upgrade refuses artifacts with mismatched checksums or invalid signatures.
- [x] The daemon is stopped and restarted safely during native upgrades.
- [x] CLI output clearly reports success, restart status, and rollback guidance.
- [x] Tests or smoke scripts cover successful upgrade and verification failure.

## Dependencies

- Depends on TASK-059.
- Should coordinate with TASK-060 so installer and upgrader share artifact
  verification logic.

## Notes

- Full automatic updates and background scheduling remain out of scope for MVP.

## Completion Notes

- Added `littleimp update install` with `littleimp update upgrade` as an alias
  for explicit packaged native upgrades. `littleimp update check` remains
  read-only.
- The CLI can install the latest compatible release found by the update source,
  download a selected release version from a release artifact base URL, or use a
  local archive plus checksum and optional detached signature.
- Upgrade archives are verified with SHA-256 before extraction, detached
  signatures are verified when present, unsafe archive layouts are rejected, and
  the packaged `daemon/install.sh --upgrade` path handles stop/install/start.
- After installer execution, the CLI verifies `/health` reports the expected
  upgraded version and prints rollback guidance if installer execution or health
  verification fails.
- Added focused daemon CLI tests for successful local archive upgrade, selected
  artifact download, checksum refusal, and invalid signature refusal.
- Updated README, update-system design, roadmap, overview, PRD, changelog, and
  release checklist documentation for the supported manual packaged upgrade
  workflow.
