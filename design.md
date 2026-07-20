# Design — Grimoire

A locked visual system for Grimoire’s application surfaces. Every redesign
reads this file before adding or changing visual code. It protects the product’s
local-first, search-first character while making its dense operational work
calmer to scan.

## Genre

Modern-minimal operational software.

## Tone

Quiet: deliberate hierarchy, low-chroma surfaces, and violet used as a signal
rather than decoration. The application should feel settled under a large
library, not empty or ornamental.

## Macrostructure family

- Library application surface: **Workbench** — a persistent search command,
  one clear results plane, and controls grouped by task rather than rendered as
  a flat field of chips.
- Configuration and reference surfaces: **Index-First** — a small local index
  that jumps between named settings domains; the active domain remains readable
  as a continuous form.
- Bookmark detail surface: **Reading-led workspace** — source, title, status,
  content, and related material follow retrieval order. This is a focused app
  panel, not a marketing long-read.

## Theme

The default application canvas is a tinted night surface. Light mode mirrors
the same semantic relationships with a cool off-white canvas.

- `--color-paper`: `oklch(16% 0.016 278)`
- `--color-paper-raised`: `oklch(19% 0.018 278)`
- `--color-ink`: `oklch(92% 0.012 278)`
- `--color-ink-muted`: `oklch(69% 0.018 278)`
- `--color-rule`: `oklch(29% 0.016 278)`
- `--color-accent`: `oklch(66% 0.17 292)`
- `--color-accent-ink`: `oklch(97% 0.008 278)`
- `--color-focus`: `oklch(73% 0.20 292)`

Accent coverage stays below five percent of a viewport. It marks the focused
search command, selected navigation, primary commitment, and focus only.
Semantic success, warning, and destructive states remain distinct from violet.

## Typography

- Display: Manrope, 600–700, roman.
- Body: Inter, 400–500.
- Metadata and technical values: JetBrains Mono, 400–500.
- Display tracking: `-0.02em`; body copy stays at or above 14 px.
- Numeric columns use tabular figures.

## Spacing and surfaces

Use a named 4 px scale. A page has three depths only: canvas, raised work
surface, and temporary overlay. Borders carry separation; shadows are limited
to a low-contrast hover lift on light mode and are not used as dark-mode glow.
Cards are reserved for selectable content, not for every group of controls.

## Motion and feedback

- No page reveals or decorative loops.
- Use `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` and 120 / 220 ms durations.
- Animate only opacity and transform.
- Focus rings appear immediately and visibly.
- `prefers-reduced-motion` reduces non-functional motion to a 150 ms opacity
  transition.

## Interaction voice

- Search is always the strongest control.
- Primary actions use a compact solid button; reversible secondary actions use
  text or outline controls.
- One visible high-frequency action per bookmark state; the rest live in an
  explicit overflow menu that works with pointer, keyboard, and touch.
- Filters are disclosed as a named refinement task with active-filter summary,
  not as a permanent row of equal-weight controls.
- Toasts report quiet, actionable outcomes; no celebratory treatment.

## Page requirements

### Library

Keep the left rail and command search. Separate result context, view/sort, and
refinement controls. Make compact list retrieval the default; preserve the grid
as a selectable visual mode. Keep narrow-screen controls single-line and
full-width where needed.

### Bookmark detail

Keep the existing data and actions. Reorder the panel around retrieval:
identity and status, summary and notes, classification, related material, then
secondary actions. Avoid a permanent wall of equally prominent buttons.

### Settings

Group configuration into AI, Library, Backup, and System domains. Provide a
local section index on wide screens and an accessible compact selector on
narrow screens. Advanced remote-backup and recovery controls remain available
but start collapsed until their domain is opened.

## Invariants

- Preserve existing routes, API clients, data flows, copy intent, keyboard
  shortcuts, and loopback-first security behavior.
- No decorative imagery, fake browser chrome, new third-party UI runtime, or
  generated metrics/testimonials.
- All affected pages share these tokens, type roles, action hierarchy, and
  responsive behavior.
