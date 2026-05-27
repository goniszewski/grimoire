# Two-Week Engineering Presentation Design

Date: 2026-05-27
Audience: technical contributors
Artifact: `docs/presentations/little-imp-two-week-engineering-update.html`

## Context

Little Imp has accumulated a dense release-readiness slice over the last two
weeks. The source window is 2026-05-13 through 2026-05-27, covering 34 committed
changes on `develop` plus the current workspace diagnostics/support-bundle work.
The presentation should help contributors understand what changed, why the
decisions matter, and where the release risk was reduced.

The deck is a contributor-facing engineering update, not a marketing deck. It
should make the project easier to maintain by connecting shipped features to
architecture, operational safety, and verification evidence.

## Goals

- Summarize the notable features, fixes, and hardening work implemented in the
  last two weeks.
- Explain key engineering decisions, especially where they set long-term
  architecture direction.
- Show visual summaries for activity, workstreams, data flows, distribution,
  recovery, and validation.
- Keep the artifact self-contained and easy to open without a dev server.
- Avoid changing app runtime code or build configuration.

## Non-Goals

- Do not create a production documentation site.
- Do not depend on React, Vite, Tailwind, or repository build steps.
- Do not claim future or unverified work as shipped.
- Do not stage or modify unrelated current workspace changes.

## Content Structure

The deck will be a single static HTML file with these sections:

1. Opening summary: 34 commits, date range, dominant outcome, and release-readiness theme.
2. Workstream overview: grouped tracks for contracts, AI/runtime settings,
   backup/restore, distribution, updates, recovery UX, diagnostics, and validation.
3. Timeline: commit/activity rhythm by date, with milestone callouts.
4. Architecture decisions:
   - daemon-owned API contract as the source of truth
   - persisted Settings as runtime capability source
   - local-only Docker trust boundary
   - encrypted backup packages wrapping the existing snapshot format
   - release archives as the install/upgrade substrate
   - read-only update checks before explicit upgrade install commands
5. Feature deep dives:
   - multi-provider AI and custom embeddings
   - backup verification, encryption, restore, rollback, and restart guidance
   - packaging, one-command install, Homebrew, and upgrade flow
   - pipeline reprocess and failure recovery UX
   - diagnostics and support bundle
6. Notable fixes and hardening:
   - queue retry persistence
   - backup/restore safety
   - Docker loopback binding and static app serving
   - release archive portability and Linux matrix validation
   - API/frontend schema drift prevention
7. Verification evidence: quality gates, installed-app smoke, installer matrix,
   focused tests, docs drift checks, and release validation.
8. Contributor takeaways: current architecture shape and next likely review
   hotspots.

## Interaction Model

- Slide-based layout with previous/next buttons.
- Keyboard navigation with ArrowLeft, ArrowRight, Home, and End.
- Progress indicator and slide counter.
- Workstream filter chips to focus the overview and key decisions by area.
- Expandable technical notes for implementation detail without cluttering slides.
- Jump menu for quick navigation across sections.
- Print-friendly layout for exporting to PDF through the browser.

## Visual Design

The deck should feel like an engineering control-room report: dense enough for
technical review, readable on a projector, and visually distinct from the app UI.
It should use a balanced palette with neutral surfaces, green for safety/recovery
progress, blue for contracts/distribution, amber for risk, and red only for fixed
failure modes.

Visualizations will be implemented with semantic HTML, CSS, and lightweight
inline SVG where useful:

- commit activity timeline by date
- workstream matrix showing features, fixes, decisions, and evidence
- API contract flow from daemon schema to generated docs and frontend types
- backup/restore recovery flow
- release artifact pipeline from package to install to upgrade
- risk-to-fix map for notable hardening work
- verification coverage board

## Data Sources

Primary data comes from:

- `git log --since='2026-05-13 00:00'`
- task files under `tasks/done/TASK-041` through `TASK-070`
- `CHANGELOG.md`
- `README.md`
- `docs/overview.md`
- current uncommitted diagnostics files, labelled as in-workspace work

The deck will not fetch remote data. All numbers and claims should be static and
traceable to local repository evidence.

## Architecture

The artifact will be one standalone HTML file under `docs/presentations/`.

- CSS will live in a `<style>` block.
- JavaScript will live in a `<script>` block.
- Presentation data will be represented as plain JavaScript arrays/objects.
- Interactions will use DOM APIs only.
- No network calls, external fonts, external scripts, or generated assets.

This structure minimizes maintenance cost and lets contributors open the file
directly in a browser.

## Components

- `slides`: ordered article elements with section metadata.
- `workstreams`: shared data used by overview filters and summary cards.
- `decisions`: decision cards with context, choice, and consequence.
- `evidence`: validation entries grouped by command or test type.
- `navigation`: previous/next controls, jump menu, keyboard handlers.
- `filters`: workstream chips that show relevant cards and dim unrelated items.
- `notes`: expandable detail panels for implementation specifics.

## Error Handling

Because this is a static local artifact, runtime error handling is limited to
defensive DOM checks:

- JavaScript should no-op gracefully if an optional control is missing.
- Navigation should clamp slide indexes to valid bounds.
- Filter state should fall back to showing all workstreams.

## Accessibility

- Use semantic sections, headings, buttons, and lists.
- Ensure keyboard navigation works without a pointer.
- Keep color contrast high enough for dark and light projector conditions.
- Provide visible focus states.
- Avoid relying on color alone for status distinctions.

## Testing And Verification

Verification will be local and focused:

- Open the HTML file path in a browser-compatible context.
- Run a lightweight static check with Node or shell tooling to confirm slide
  count, required controls, and no external script/style references.
- Use browser automation if available to verify keyboard navigation and capture
  a screenshot.
- Confirm the final git diff touches only the presentation artifact, unless
  implementation exposes a necessary supporting documentation update.

## Open Decisions

The user has approved a technical-contributor audience and release-readiness deep
dive. No additional product or audience decisions are required before
implementation.
