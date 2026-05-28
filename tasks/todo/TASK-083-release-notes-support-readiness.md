# TASK-083: Release Notes and Support Readiness

**Phase:** MVP release closeout
**Priority:** medium
**Status:** todo
**Area:** documentation / support / release

## Description

Prepare the public-facing release notes and support material needed for first
MVP users to install, verify, troubleshoot, and report issues.

## Scope

1. Draft final GitHub release notes from `CHANGELOG.md`, README, roadmap, and
   release validation evidence.
2. Call out recommended install path, alternate Homebrew path, manual archive
   path, supported OS matrix, and known limitations.
3. Include checksum/signature verification guidance and the no-telemetry,
   local-first support posture.
4. Include troubleshooting links for daemon health, Homebrew Bun dependency,
   Docker port binding, backup/restore recovery, update checks, and diagnostics.
5. Confirm issue/security reporting guidance is clear.

## Acceptance Criteria

- [ ] GitHub release notes are ready to publish with the final release.
- [ ] Notes include supported install paths and supported OS matrix.
- [ ] Known limitations are explicit and match `SECURITY.md` and
      `docs/roadmap.md`.
- [ ] Troubleshooting guidance points to existing docs instead of duplicating
      stale instructions.
- [ ] Security reporting avoids public vulnerability disclosure.

## Dependencies

- Should follow TASK-075.
- Should incorporate evidence from TASK-076 through TASK-082 before final
  publication.

## Notes

- This task is user-facing release communication, not marketing copy.
