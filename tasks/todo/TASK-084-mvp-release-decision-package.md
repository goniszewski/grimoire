# TASK-084: MVP Release Decision Package

**Phase:** MVP release closeout
**Priority:** medium
**Status:** todo
**Area:** release / QA / project management

## Description

Produce the final go/no-go package for the MVP-ready build, summarizing release
commit, artifacts, validation evidence, skipped checks, known limitations, and
the publication decision.

## Scope

1. Record release commit, branch, tag, GitHub release URL, artifact inventory,
   checksums, and signature status.
2. Summarize CI, local quality gates, Playwright, daemon, installed-app,
   Docker, installer matrix, Homebrew, update, backup/restore, diagnostics, and
   security regression evidence.
3. List skipped checks with concrete reasons, especially unavailable hardware or
   publication-gated steps.
4. List known limitations that remain acceptable for MVP.
5. Make a clear go/no-go recommendation and identify any release-blocking
   follow-up.
6. Update `tasks/README.md` after TASK-075 through TASK-084 are complete or
   explicitly deferred.

## Acceptance Criteria

- [ ] Release decision package links to or records every required validation
      class.
- [ ] Skipped checks are explicit and defensible.
- [ ] Known limitations match docs and release notes.
- [ ] Go/no-go decision is clear.
- [ ] Task board reflects the final state of the MVP release-closeout queue.

## Dependencies

- Should be the final task in this release-closeout set.

## Notes

- This task is the final release-control artifact. It should not hide unresolved
  blockers behind broad "known issue" language.
