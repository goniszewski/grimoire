# Quiet Operational UI Redesign

## Goal

Redesign Little Imp’s highest-impact application surfaces so developers can
retrieve, triage, and maintain bookmarked technical knowledge with less visual
competition. The work applies the approved quiet tone without changing product
behavior.

## Audience and primary job

The audience is developers with growing libraries of technical resources. Their
primary job is to find a saved item quickly, judge its state and relevance, and
take the next appropriate action.

## Chosen approach

Use the quiet-workbench approach:

- Keep the local-first dark-violet identity, existing route structure, and
  keyboard-first search behavior.
- Make search and result context primary; group secondary filters under an
  explicit refinement task.
- Make compact list retrieval the default while retaining the grid view.
- Recompose bookmark details around retrieval order and move secondary actions
  into an accessible overflow menu.
- Split the long settings form into navigable domains without changing its
  fields, API calls, or save behavior.

The alternatives considered were a document-like quiet index for all views and
a spacing-only polish. The former would make mixed bookmark content less
scannable; the latter would leave the primary control-density problem intact.

## Design system

`design.md` is the authoritative visual system. It defines a modern-minimal
operational genre, quiet violet usage, Manrope / Inter / JetBrains Mono roles,
three surface depths, and motion limited to state feedback.

Application surfaces use the following structures:

- Library: Workbench.
- Settings: Index-First configuration domains.
- Bookmark detail: reading-led retrieval workspace.

## Implementation boundaries

Modify only the visual and interaction layers of these production files:

- `src/index.css`
- `src/pages/Index.tsx`
- `src/components/SearchBar.tsx`
- `src/components/BookmarkCard.tsx`
- `src/components/BookmarkDetail.tsx`
- `src/components/BookmarkDetailContent.tsx`
- `src/components/AppSidebar.tsx`
- `src/pages/Settings.tsx`

Add `tokens.css`, `.hallmark/log.json`, and a task report with inspected
desktop and narrow-screen evidence. Do not delete files, change routes, alter
daemon/API behavior, or add dependencies.

## Interaction requirements

- Library controls must have clear tiers: search, result context, refinement,
  and bulk actions.
- Active refinements must remain visible and individually removable.
- Bookmark actions must be usable on hover, keyboard focus, and touch.
- Settings navigation must point to existing semantic sections and not conceal
  a required configuration field.
- Buttons, links, and selected controls remain single-line at 320, 375, 414,
  and 768 px; interactive targets meet 44 px minimum below 640 px.
- Reduced-motion behavior must be provided centrally.

## Verification

- Run lint, frontend type-check, focused component/page tests, and production
  build.
- Capture and inspect the Library, Bookmark Detail, and Settings at desktop and
  narrow widths.
- Run `git diff --check` and update the task report/index according to the
  repository instructions.

## Self-review

This scope is visual and interaction-only, names every affected production
surface, preserves all existing operational behavior, and has no placeholders
or unresolved dependencies.
