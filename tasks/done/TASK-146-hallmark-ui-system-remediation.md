# TASK-146: Hallmark UI System Remediation

**Phase:** Product reset and public beta
**Priority:** medium (P2)
**Status:** done
**Area:** frontend / design system / accessibility

## Description

Resolve the visual-system and interaction issues identified by the Hallmark
audit without changing Little Imp's operational, local-first product character.

## Scope

1. Replace the generic display treatment, pure neutral extremes, and raw
   status-color utilities with a coherent semantic token system.
2. Make bookmark-card actions discoverable through keyboard focus and compact
   touch layouts, and label the bookmark title edit control.
3. Replace broad visual transitions with targeted properties.
4. Fix the narrow library header so primary controls do not clip or create
   horizontal scrolling.
5. Capture desktop and narrow visual evidence in a task report.

## Acceptance Criteria

- [x] Display and body typography use distinct roles, and neutral surfaces are
      tinted rather than pure white or black.
- [x] Status colors use shared semantic tokens across the audited surfaces.
- [x] Bookmark actions are reachable through keyboard focus and visible on
      compact layouts.
- [x] The library has no horizontal overflow at 320, 375, 414, 768, 1440, or
      1920 CSS-pixel viewport widths.
- [x] Focused regressions, full unit tests, lint, frontend type check, build,
      and whitespace validation pass.

## Verification

- `npm test` — 304 tests passed.
- `npm run type-check:frontend` passed.
- `npm run lint` passed with eight existing Fast Refresh warnings and no errors.
- `npm run build` passed.
- `git diff --check` passed.
- Visual evidence: [Hallmark UI System Remediation report](../../docs/task-reports/2026/07/2026-07-18-hallmark-ui-system-remediation/index.html).

## Work Notes

- July 18, 2026: Added semantic info, success, warning, and knowledge tokens;
  Manrope display typography; tinted neutral surfaces; explicit card
  transitions; focus and touch-safe bookmark actions; an accessible title-edit
  label; and a compact responsive header.
