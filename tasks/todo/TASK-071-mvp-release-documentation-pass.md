# TASK-071: MVP Release Documentation Pass

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
**Area:** documentation / release

## Description

Perform the final documentation alignment for the MVP-ready build after the
distribution, recovery, diagnostics, and validation tasks land. The goal is a
single accurate product narrative for users, contributors, and release
operators.

## Scope

1. Update `README.md` around the recommended install path, manual archive path,
   Homebrew path if available, upgrade path, backup recovery, diagnostics, and
   troubleshooting.
2. Update `docs/roadmap.md` to distinguish shipped MVP readiness work from
   post-MVP ideas.
3. Update `docs/prd.md` and `docs/overview.md` to match the implemented MVP
   state.
4. Update `docs/release-checklist.md` with final artifact, installer, matrix,
   backup, diagnostics, and installed-app smoke checks.
5. Update `docs/update-system.md` to describe what is shipped versus deferred.
6. Update `CHANGELOG.md`, `SECURITY.md`, and `CONTRIBUTING.md` where behavior or
   workflow changed.
7. Run API docs generation and markdown/link checks where available.

## Acceptance Criteria

- [ ] User-facing docs describe installation without cloning as the primary MVP
      path.
- [ ] Upgrade, backup, restore, diagnostics, and rollback guidance are accurate.
- [ ] Roadmap and PRD no longer describe shipped MVP readiness work as future.
- [ ] Release checklist is executable by someone who did not implement the work.
- [ ] Generated API docs and local documentation checks pass or any skipped
      checks are documented.

## Dependencies

- Should be the final task in this MVP-readiness set.

## Notes

- Do not use this task to introduce new product behavior. It is the final
  consistency pass after implementation tasks land.
