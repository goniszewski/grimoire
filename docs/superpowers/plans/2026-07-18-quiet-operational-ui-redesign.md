# Quiet Operational UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Little Imp’s Library, Bookmark Detail, and Settings calmer to scan and faster to operate without changing routes, APIs, or persistence behavior.

**Architecture:** `design.md` locks the shared quiet system. A new `tokens.css` holds semantic values while `src/index.css` maps the values to the existing shadcn/Tailwind variables. The Library changes control hierarchy only, bookmark action callbacks stay intact, and Settings gains in-page anchors around existing sections.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3, Radix UI, Vitest, Testing Library, Playwright.

## Global Constraints

- Keep routes, API clients, daemon behavior, keyboard shortcuts, and loopback-first boundaries unchanged.
- Add no dependencies and delete no production files.
- Use the quiet violet tokens and type roles in `design.md`.
- Make compact list retrieval the default, retaining grid as a user-selectable view.
- Keep action labels single-line at 320, 375, 414, and 768 px; targets are at least 44 px below 640 px.
- Use only opacity and transform motion and add a central reduced-motion fallback.
- Do not commit unless explicitly requested by the user.

### Task 1: Establish shared quiet tokens

**Files:** Create `tokens.css`; modify `src/index.css:1-132`; test `src/pages/Index.test.tsx`.

**Interfaces:** Produces `--color-*`, `--font-*`, `--space-*`, `--ease-out`, and `--dur-*` custom properties. `src/index.css` imports the file above Tailwind directives and applies the shared typography and motion roles while retaining the established semantic HSL theme variables.

- [ ] Write the failing test: `expect(tokensCss).toContain("--color-accent: oklch(")`, `expect(indexCss).toContain('@import url("../tokens.css")')`, and `expect(indexCss).toContain("@media (prefers-reduced-motion: reduce)")`.
- [ ] Run `npm run test -- src/pages/Index.test.tsx`; expect red because `tokens.css`, its import, and the reduced-motion rule are absent.
- [ ] Add the exact design values: `--color-paper: oklch(16% 0.016 278)`, `--color-paper-raised: oklch(19% 0.018 278)`, `--color-ink: oklch(92% 0.012 278)`, `--color-ink-muted: oklch(69% 0.018 278)`, `--color-rule: oklch(29% 0.016 278)`, `--color-accent: oklch(66% 0.17 292)`, and `--color-focus: oklch(73% 0.20 292)`.
- [ ] Add `--font-display: "Manrope", "Inter", system-ui, sans-serif`, `--font-body: "Inter", system-ui, sans-serif`, `--font-mono: "JetBrains Mono", monospace`, a 4 px spacing scale, `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`, `--dur-micro: 120ms`, and `--dur-short: 220ms`.
- [ ] Add a 150 ms `prefers-reduced-motion: reduce` rule; use it without changing functional loaders.
- [ ] Run `npm run test -- src/pages/Index.test.tsx`; expect green with the new contract test and existing Index tests.

### Task 2: Recompose Library hierarchy

**Files:** Modify `src/pages/Index.tsx:345-629`, `src/components/SearchBar.tsx:44-67`, and `src/components/AppSidebar.tsx:520-930`; test `src/pages/Index.test.tsx`.

**Interfaces:** Consumes current `useBookmarks()` filters and `usePreferences().viewMode` / `updatePreferences`. Produces a `Refine library` disclosure, a result-context row, a view/sort row, and `data-testid="bookmark-results"`.

- [ ] Write failing tests that find a `Refine library` button, confirm the `Pinned filter` combobox is absent before opening it, confirm it is present after click, and assert the list preference renders `bookmark-results` with `flex-col`.
- [ ] Run `npm run test -- src/pages/Index.test.tsx`; expect red for the missing disclosure and result test id.
- [ ] Add `const [refineOpen, setRefineOpen] = useState(false)` and a control row with result count, `Refine library`, view-mode choice, and current sort choice. Preserve active-filter badges above the row.
- [ ] Move date, read state, pin state, open state, and read-later controls into `<section id="library-refinements" aria-label="Library refinements">`; keep bulk operations in their separate selection-mode branch.
- [ ] Render cards inside `<div data-testid="bookmark-results" className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" : "flex flex-col gap-2"}>`.
- [ ] Update the default preference fallback to `list`; preserve a user’s stored grid choice and existing preference API.
- [ ] Make the search input visually primary and reduce sidebar labels/count contrast without changing sidebar navigation or category behavior.
- [ ] Run `npm run test -- src/pages/Index.test.tsx`; expect green including existing selection, pagination, filter, and export tests.

### Task 3: Make bookmark actions explicit

**Files:** Modify `src/components/BookmarkCard.tsx:180-420`, `src/components/BookmarkDetail.tsx:103-195`, and `src/components/BookmarkDetailContent.tsx`; test `src/components/BookmarkCard.test.tsx` and `src/components/BookmarkDetail.test.tsx`.

**Interfaces:** Consumes all existing pin, archive, read, read-later, tag, category, and notes callbacks. Produces an accessible overflow trigger named `More bookmark actions` and a detail header ordered source, title, pipeline status, primary action, then content.

- [ ] Write a failing card test that opens `More bookmark actions` and expects an `Archive` menuitem. Write a failing detail test that confirms the `Indexed` status appears before `detail-content` in document order.
- [ ] Run `npm run test -- src/components/BookmarkCard.test.tsx src/components/BookmarkDetail.test.tsx`; expect red for the missing overflow trigger/menu and status ordering.
- [ ] Use the existing Radix `DropdownMenu` component with `<Button aria-label="More bookmark actions" variant="ghost" size="icon">`; put Archive, read-state, Read later, and Copy URL actions inside the menu, retaining an explicit confirmed Move to trash action in both grid and compact list rows.
- [ ] Keep one contextually relevant primary state action visible, retain title click-to-open behavior, and retain keyboard focus visibility.
- [ ] In Bookmark Detail, render source/domain, title, `PipelineBadge`, and visible primary actions ahead of summary, notes, classification, and related items. Preserve the current desktop dialog and mobile drawer branches.
- [ ] Run the focused tests again; expect green with current callback expectations unchanged.

### Task 4: Index existing Settings domains

**Files:** Modify `src/pages/Settings.tsx:901-2170`; test `src/pages/Settings.test.tsx`.

**Interfaces:** Consumes the existing form state, mutations, backup hooks, and section markup. Produces `nav[aria-label="Settings sections"]` and `settings-ai`, `settings-library`, `settings-backup`, and `settings-system` anchors.

- [ ] Write a failing test that renders Settings, finds navigation named `Settings sections`, and asserts links named AI and Backup have `href="#settings-ai"` and `href="#settings-backup"`.
- [ ] Run `npm run test -- src/pages/Settings.test.tsx`; expect red because the index and anchors are absent.
- [ ] Wrap existing settings blocks in a `lg:grid-cols-[10rem_minmax(0,1fr)]` layout. Add a sticky wide-screen navigation with AI, Library, Backup, and System links; on narrow screens it becomes a wrapping 44 px link row.
- [ ] Assign existing LLM/embedding fields to `settings-ai`, maintenance/browser integration to `settings-library`, local/remote backup/restore/schedule to `settings-backup`, and updates/diagnostics to `settings-system`.
- [ ] Retain every form field, confirmation dialog, recovery instruction, mutation, and global Save control; advanced backup controls can be collapsed only after their Backup domain is explicitly selected.
- [ ] Run `npm run test -- src/pages/Settings.test.tsx`; expect green with existing Settings tests.

### Task 5: Capture evidence, task report, and verification

**Files:** Create `.hallmark/log.json`; create `docs/task-reports/2026/07/2026-07-18-quiet-operational-ui-redesign/index.html` plus `assets/01-before-library.png`, `02-after-library.png`, `03-after-narrow.png`, `04-detail.png`, and `05-settings.png`; modify `docs/task-reports/2026/07/index.html`, `docs/task-reports/2026/index.html`, and `docs/task-reports/index.html`.

**Interfaces:** Produces one app-scope Hallmark memory record and a self-contained report that follows `docs/task-reports/INSTRUCTION.md`.

- [ ] Write `.hallmark/log.json` with one record: date `2026-07-18`, scope `app`, macrostructure `Workbench / Index-First`, theme `custom`, theme axes `dark / geometric-sans / cool`, vibe `quiet operational violet`, enrichment `none`, and the Little Imp redesign brief.
- [ ] Start the daemon and Vite application, load demo data if needed, and capture Library before/after at least 1920×1080, narrow Library at 390×700 and device scale factor 2, Bookmark Detail, and Settings.
- [ ] Inspect Library, Detail, and Settings at 320, 375, 414, and 768 px for no horizontal scroll, visible focus, and single-line clickable labels.
- [ ] Create the report with `02-after-library.png` as hero, a before/problem/changes/result/verification narrative, links to the affected source files, and the shared lightbox helper. Add it newest-first to the July index and update parent indexes where their latest cards appear.
- [ ] Run `npm run lint`, `npm run type-check:frontend`, `npm run test -- src/pages/Index.test.tsx src/components/BookmarkCard.test.tsx src/components/BookmarkDetail.test.tsx src/pages/Settings.test.tsx`, `npm run build`, and `git diff --check`. Every command must exit 0; otherwise report the exact failed command and keep its surface unverified.

## Plan self-review

- Spec coverage: Tasks 1–4 implement the approved shared system, Library hierarchy, detail actions, Settings domains, responsive constraints, and motion rule; Task 5 covers Hallmark memory, visual evidence, report hygiene, and validation.
- Placeholder scan: the plan has no unresolved work markers or ambiguous implementation steps.
- Interface consistency: each UI task consumes current state/callback interfaces and does not introduce a daemon or route contract.
