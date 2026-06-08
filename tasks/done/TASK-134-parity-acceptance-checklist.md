# TASK-134: Final Grimoire Parity Acceptance Checklist

**Phase:** Verification and release readiness
**Priority:** medium (P2)
**Status:** done
**Area:** documentation / parity

## Description

Address PAR-054: produce a one-page acceptance checklist that confirms every approved parity gap is closed with passing API, daemon, frontend, visual, and E2E verification. Consolidate evidence references from the parity report, the recurring release checklist, and individual task completion notes.

## Scope

1. **Produce `docs/parity/parity-acceptance-checklist.md`:**
   - List every approved parity task from `docs/parity/grimoire-parity-task-proposals.md` with development status "Done"
   - For each task, cite the verification evidence: daemon test names, frontend test names, contract check outputs, visual verification references, and any E2E test IDs
   - Cross-reference evidence from:
     - `docs/parity/grimoire-feature-parity-report.md`
     - `docs/release-checklist.md` (Recurring Grimoire Parity Review section)
     - Individual TASK completion notes
     - `npm run check` outputs
     - `npm run test:e2e` outputs
   - Mark any gaps where verification evidence is missing but the task is marked done (these become remediation notes)

2. **Review with the parity report:**
   - Ensure the parity report's "Key Remaining Gaps" section (URL/summary mutation, Grimoire backup import, packaged browser extension) still accurately reflects what's deferred
   - Ensure the "Intentional Non-Goals" table is up to date
   - If any task marked "Done" has weaker evidence than expected, add a note with the remediation path

3. **Link from the release decision doc:**
   - Add a reference to the new checklist from `docs/release-decision-v0.1.0-beta.md` in the validation evidence section

## Acceptance Criteria

- [x] Every approved parity gap has a documented verification signal.
- [x] Gaps with missing or weak evidence are explicitly noted with a remediation path.
- [x] The parity report's non-goals and deferred items remain accurate.
- [x] The release decision doc references the parity acceptance checklist.
- [x] No new parity gaps are discovered (all non-goals are intentional).

## Dependencies

- TASK-133 (parity task reports and screenshots) — provides the visual verification evidence to cite.
- `docs/parity/grimoire-parity-task-proposals.md` — the source of approved tasks.
- `docs/parity/grimoire-feature-parity-report.md` — the executive summary to validate against.

## Notes

- This is a documentation-only task. Do not implement product changes.
- The goal is to make it easy for a reviewer to verify: "Every parity gap claimed as done actually has evidence."

## Work Notes

- June 8, 2026: Selected as the next logical unblocked task because TASK-078
  and TASK-079 still return public artifact `404`s, while TASK-134 depends only
  on completed TASK-133 evidence.
- Added `docs/parity/parity-acceptance-checklist.md` with a per-PAR evidence
  matrix for all approved done parity rows, plus explicit deferred/rejected row
  notes for non-goals and future product decisions.
- Updated `docs/parity/grimoire-parity-task-proposals.md` so PAR-051,
  PAR-052, and PAR-054 reflect completed TASK-133/TASK-134 work instead of
  stale pending status.
- Linked the checklist from the recurring release checklist and the
  `v0.1.0-beta` release decision validation table.
- Added the TASK-134 task report under
  `docs/task-reports/2026/06/2026-06-08-task-134-parity-acceptance-checklist/`
  and linked it from the task-report indexes.
- Verification passed:
  - `git diff --check`
  - `npx vitest run scripts/parity-release-checklist.test.ts scripts/task-report-lightbox.test.ts`
  - `npm run docs:api:check` with existing static status-code drift warnings
    and "API documentation is up to date."
  - Local relative-link audit over the touched Markdown and HTML files.
- June 8, 2026 review follow-up: corrected a PAR-054 status overclaim so the
  worksheet stayed in review until TASK-134 was accepted, then moved the task
  and worksheet row to done together.
