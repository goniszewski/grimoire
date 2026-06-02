# TASK-134: Final Grimoire Parity Acceptance Checklist

**Phase:** Verification and release readiness
**Priority:** medium (P2)
**Status:** todo
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

- [ ] Every approved parity gap has a documented verification signal.
- [ ] Gaps with missing or weak evidence are explicitly noted with a remediation path.
- [ ] The parity report's non-goals and deferred items remain accurate.
- [ ] The release decision doc references the parity acceptance checklist.
- [ ] No new parity gaps are discovered (all non-goals are intentional).

## Dependencies

- TASK-133 (parity task reports and screenshots) — provides the visual verification evidence to cite.
- `docs/parity/grimoire-parity-task-proposals.md` — the source of approved tasks.
- `docs/parity/grimoire-feature-parity-report.md` — the executive summary to validate against.

## Notes

- This is a documentation-only task. Do not implement product changes.
- The goal is to make it easy for a reviewer to verify: "Every parity gap claimed as done actually has evidence."
