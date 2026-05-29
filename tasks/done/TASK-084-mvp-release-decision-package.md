# TASK-084: MVP Release Decision Package

**Phase:** MVP release closeout
**Priority:** medium
**Status:** done
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

- [x] Release decision package links to or records every required validation
      class.
- [x] Skipped checks are explicit and defensible.
- [x] Known limitations match docs and release notes.
- [x] Go/no-go decision is clear.
- [x] Task board reflects the final state of the MVP release-closeout queue.

## Dependencies

- Should be the final task in this release-closeout set.

## Notes

- This task is the final release-control artifact. It should not hide unresolved
  blockers behind broad "known issue" language.

## Work Notes

- May 29, 2026: Selected as the next logical task because TASK-078, TASK-079,
  and TASK-080 are still in progress with documented external/environment
  blockers, while TASK-084 is the last not-yet-started release-control task.
- Added `docs/release-decision-v0.1.0-beta.md` as the tracked go/no-go package.
- Refreshed the release facts before writing the decision package:
  - authenticated `gh release view v0.1.0-beta --repo goniszewski/little-imp`
    confirms a non-draft prerelease with seven expected assets;
  - `gh repo view goniszewski/little-imp` confirms the repository is private;
  - unauthenticated `curl -I -L` checks still return `404` for the tag-qualified
    raw installer and macOS/Linux release archive URLs;
  - GitHub Actions `Quality Gates` succeeded for current `develop` head
    `2bec19077d5a063caec31bfc9e3fa3d52cfce8e4`.
- The package records the release tag target
  `50333cab0bc28edbfa26a81c0542510a357a1605`, current prerelease URL, artifact
  inventory, SHA-256 values, detached signature status, validation evidence,
  skipped checks, acceptable MVP limitations, and required follow-up.
- The decision is **no-go for public MVP promotion** until unauthenticated
  distribution access is fixed or an authenticated distribution path is
  deliberately adopted and validated.
- TASK-078 remains the primary release-blocking follow-up. TASK-079 and
  TASK-081 are blocked by the same public artifact visibility issue, and
  TASK-080 remains an unresolved fresh-data UX smoke environment gap.
- TASK-078, TASK-079, and TASK-080 are not deferred by this decision package;
  they remain in progress and must be completed or explicitly release-owner
  accepted before public promotion.
- Updated `README.md` to link the release decision package and updated
  `tasks/README.md` and `docs/roadmap.md` to mark TASK-084 complete while
  keeping TASK-078, TASK-079, and TASK-080 in progress.
- Review follow-up tightened the decision package so CI evidence is attributed
  to the last pushed `develop` head before the TASK-084 docs edits, and roadmap
  post-MVP language no longer treats prerelease publication as public
  promotion.

## Verification

- `npx tsc --noEmit` passed.
- `npm test` passed with 23 test files and 155 tests.
- `npm run docs:api:check` passed.
- `git diff --check` passed.
- Local relative Markdown link audit passed across `README.md`,
  `CONTRIBUTING.md`, `tasks/README.md`, and Markdown files under `docs/`.
- Stale TASK-084 todo-reference scan passed outside this task note.
