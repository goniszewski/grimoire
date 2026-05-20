# TASK-058: MVP Evidence and Acceptance Criteria Audit

**Phase:** MVP readiness
**Priority:** high
**Status:** done
**Area:** product / QA / documentation

## Description

Audit the completed task board, implementation, and release documentation before
adding new MVP surface area. Some task files under `tasks/done/` still contain
unchecked acceptance criteria even though the roadmap describes the related
features as shipped. This task separates stale task-file checkboxes from real
product gaps.

## Scope

1. Review all `tasks/done/` files with unchecked acceptance criteria.
2. Verify each unchecked item against implementation, tests, and docs.
3. Update stale task files so completed criteria are marked consistently.
4. Create follow-up task notes for any criteria that are not actually shipped.
5. Confirm `docs/roadmap.md`, `docs/prd.md`, `docs/overview.md`,
   `CHANGELOG.md`, and `tasks/README.md` describe the same current state.
6. Run the canonical local documentation and quality checks that are practical
   from the current workspace.

## Acceptance Criteria

- [x] Every unchecked acceptance criterion in `tasks/done/` is either marked
      complete with evidence or captured as a follow-up gap.
- [x] `tasks/README.md` reflects the verified status of done, todo, and any
      follow-up tasks.
- [x] Documentation no longer contradicts verified implementation status.
- [x] Verification commands and any skipped checks are recorded in completion
      notes.

## Notes

- This should be the first MVP-readiness task because it prevents stale task
  metadata from steering later prioritization.
- Do not implement product changes in this task unless the fix is purely
  documentation or task-board status correction.

## Completion Notes

- Audited unchecked criteria in completed task files and marked stale completed
  items in TASK-006, TASK-009, TASK-020, TASK-022, TASK-024, TASK-025,
  TASK-036, TASK-040, and TASK-041.
- Clarified stale failure-retry wording in TASK-004, TASK-007, TASK-020, and
  the pipeline source comment so provider-call retries are not confused with
  durable targeted retry/reprocess jobs.
- Confirmed remaining real gaps are carried forward: TASK-008 re-embedding by
  TASK-064; TASK-013 provider-change recovery and TASK-026 retry/recovery by
  TASK-064 and TASK-065; TASK-012 manual category timeline events and TASK-017
  command-palette semantic search by new backlog TASK-072.
- Updated `docs/prd.md` and `docs/overview.md` so LLM and embedding failures
  are described as non-blocking rather than already retried by targeted
  recovery jobs.
- Updated `CHANGELOG.md` so the Unreleased section includes the shipped
  post-beta operations, update-check, installer-bundle, and multi-provider AI
  work represented by TASK-049 through TASK-057.
- Updated `tasks/README.md` to move TASK-058 to done, keep TASK-059 through
  TASK-071 as the remaining MVP-readiness queue, and list TASK-072 as a
  post-MVP backlog follow-up.

Verification:

- `npx tsc --noEmit` passed during the final uncommitted-change review.
- `npm run docs:api:check` passed.
- `git diff --check` passed.
- `npm run check` passed: lint completed with existing warnings, type-checks
  passed, 101 frontend/Vitest tests passed, 315 daemon/Bun tests passed, API
  docs drift check passed, and production build completed with existing bundle
  size/Browserslist warnings.
- A local markdown-link audit initially failed because TASK-058 had not yet
  been moved from `todo` to `done`; the file was moved as part of completion.
- The local markdown-link audit then passed across `README.md`,
  `CONTRIBUTING.md`, `tasks/README.md`, and `docs/*.md`.
