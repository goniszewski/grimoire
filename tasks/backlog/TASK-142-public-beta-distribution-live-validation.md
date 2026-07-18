# TASK-142: Public Beta Distribution and Live Validation

**Phase:** Product reset and public beta
**Priority:** critical (P0)
**Status:** backlog
**Area:** release / distribution / installation

## Description

Choose and validate one real beta distribution path. Consolidate the former
public installer, Homebrew, and published-artifact backlog into a single
evidence-backed release gate.

## Scope

1. Explicitly choose public repository distribution, a separate public artifact
   channel, or an authenticated private-beta path.
2. Make the documented primary install URL reachable to the target cohort.
3. Validate one-command install and upgrade on macOS arm64 and the supported
   Ubuntu/Debian targets with checksum and signature verification.
4. Run the packaged CLI upgrade and published-artifact installed-app smoke.
5. Validate daemon health, data preservation, rollback guidance, and uninstall
   without purge.
6. Treat Homebrew as optional until the primary path passes; validate it only if
   retained as a beta promise.
7. Keep the GitHub release as a prerelease until every retained public claim passes.

## Acceptance Criteria

- [ ] The chosen beta install path is reachable by an intended user without repository-owner credentials.
- [ ] Clean install, upgrade, health, data preservation, and uninstall pass on supported targets.
- [ ] Published artifact checksum and signature verification pass.
- [ ] `npm run test:e2e:installed:published` passes against the actual beta artifact.
- [ ] Documentation advertises only paths validated in this task.

## Dependencies

- TASK-136 through TASK-141.

## Notes

- This task supersedes the former TASK-122, TASK-123, and TASK-124 backlog split.
- Changing repository visibility remains an explicit owner decision.
