# TASK-133: Parity Task Reports and Visual Verification

**Phase:** Verification and release readiness
**Priority:** medium (P2)
**Status:** todo
**Area:** documentation / QA

## Description

Address the pending PAR-051 and PAR-052 items from the parity batch. Create task reports for the Grimoire parity implementation work and capture screenshots of all parity-related UI surfaces for the task report archive.

## Scope

1. **Task reports:**
   - Create `docs/task-reports/` entries following `docs/task-reports/INSTRUCTION.md` for the Grimoire parity batch, covering:
     - Bookmark detail and metadata (TASK-089, TASK-091, TASK-092, TASK-093, TASK-094)
     - Category and tag management surfaces (TASK-095–TASK-101)
     - Import/export parity (TASK-107–TASK-113)
     - Library pagination, sorting, and filters (TASK-114–TASK-119)
     - API docs, auth, and capture (TASK-102–TASK-106)
   - Each report should include: what was implemented, verification evidence, and known limitations
   - Link all reports from `docs/task-reports/index.html`

2. **Screenshots:**
   - Launch the app and capture desktop and narrow-width screenshots of:
     - Category tree in sidebar (expanded, collapsed, nested levels)
     - Category detail page with bookmark list
     - Tag management page (list view)
     - Tag detail page with bookmark list
     - Bookmark detail drawer with metadata, extracted content, and media preview
     - Import review dialog with folder hierarchy and remapping
     - Import result report
     - Library with pagination controls and server-driven sort/filter active
     - Filter dropdown showing parity filters (read state, pinned, read-later, open metrics)
   - Store screenshots in `docs/task-reports/assets/` and reference them from the reports

## Acceptance Criteria

- [ ] Task reports exist for all parity epics with implementation scope, verification evidence, and limitations.
- [ ] Screenshots capture desktop and narrow states for all parity-related UI surfaces.
- [ ] `docs/task-reports/index.html` links to all new reports.
- [ ] Reports follow the INSTRUCTION.md format.
- [ ] No demo or real personal data appears in screenshots (use the demo fixture from TASK-129 if available, or synthetic data).

## Dependencies

- TASK-129 (first-run demo content) — if available, provides a realistic non-sensitive library for screenshots.
- Existing task report infrastructure (`docs/task-reports/INSTRUCTION.md`).

## Notes

- Screenshots should be captured in a clean isolated daemon instance. Use the demo content from TASK-129 to populate a realistic library for screenshots.
- All visual evidence should be reviewed to ensure no API keys, secrets, or real personal data appear.
