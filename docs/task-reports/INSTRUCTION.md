# Task Report Instructions

Use this process after every non-trivial task that changes visible UI, user flow, documentation presentation, release packaging, installer behavior, API behavior, or important runtime behavior. Skip routine typo fixes, tiny internal refactors, dependency housekeeping, and changes that cannot be explained meaningfully with a short visual card.

## Goal

Each report is a self-contained visual record of what changed, why it changed, and how it was verified. Reports should be useful to a future developer, designer, release operator, or reviewer who wants to understand the work without reopening the entire thread.

## Directory Structure

Use a year/month hierarchy only:

```text
docs/task-reports/
  index.html
  INSTRUCTION.md

  YYYY/
    index.html

    MM/
      index.html

      YYYY-MM-DD-<task-id-or-area>-<short-kebab-summary>/
        index.html
        assets/
          01-before-main.png
          02-after-main.png
          03-after-mobile.png
```

Create the year or month index if it does not already exist. Update every parent index when adding a new report:

- `docs/task-reports/index.html`
- `docs/task-reports/YYYY/index.html`
- `docs/task-reports/YYYY/MM/index.html`

When writing links between report pages, always link directly to `index.html` instead of linking to a directory. For example, use `2026/index.html`, `05/index.html`, and `2026-05-29-example/index.html`. Directory links such as `2026/`, `05/`, or `2026-05-29-example/` open as "Index of ..." pages in some `file://` browser contexts.

## Naming Convention

Report directory:

```text
YYYY-MM-DD-<task-id-or-area>-<short-kebab-summary>
```

Examples:

```text
2026-05-29-task-080-first-user-ux-smoke-pass
2026-05-30-settings-backup-verification-polish
2026-06-02-release-installer-validation
```

Rules:

- Use the local current date.
- Include the task ID when one exists, for example `task-080`.
- Use lowercase kebab-case.
- Keep the summary short and stable.
- Do not rename an existing report directory after linking it unless you update every parent index.

Asset names:

```text
01-before-main.png
02-after-main.png
03-after-mobile.png
04-detail-state.png
```

Rules:

- Number assets in narrative order.
- Prefer PNG screenshots for UI reports.
- Include alt text in the report for every meaningful image.
- Keep temporary capture scripts and raw scratch output outside the repo unless explicitly requested.

## Required Report Content

Every report `index.html` must include one primary self-contained card with:

- Title
- Date
- Area or task ID
- Status
- One hero screenshot or image
- Short before-state description
- Problem statement
- Changes added
- Result
- Verification
- Links to relevant files

Use collapsible `<details>` sections for longer text:

- Implementation notes
- Files changed
- Follow-ups
- Additional screenshots
- Verification details

Keep reports concise. The main card should be readable in one or two minutes. Put deeper detail behind collapsible sections.

## Recommended Report Template

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Task Title - Grimoire Task Report</title>
<style>
/* Keep styles embedded so the report is self-contained. */
</style>
<script src="../../../assets/task-report-lightbox.js" defer></script>
</head>
<body>
<main class="page">
  <article class="task-card">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="../index.html">Month</a>
    </nav>

    <header>
      <p class="eyebrow">Grimoire Task Report</p>
      <h1>Task Title</h1>
      <div class="meta-row">
        <span>YYYY-MM-DD</span>
        <span>Area or task ID</span>
        <span>Completed</span>
      </div>
    </header>

    <figure class="hero-shot">
      <img src="assets/02-after-main.png" alt="Describe the after state">
      <figcaption>After: one-sentence visual summary.</figcaption>
    </figure>

    <section>
      <h2>Before</h2>
      <p>Short description of the prior state.</p>
    </section>

    <section>
      <h2>Problem</h2>
      <p>Short statement of the user problem or implementation gap.</p>
    </section>

    <section>
      <h2>Changes Added</h2>
      <ul>
        <li>Concrete change.</li>
        <li>Concrete change.</li>
      </ul>
    </section>

    <section>
      <h2>Result</h2>
      <p>Short summary of the resulting behavior or visual state.</p>
    </section>

    <section>
      <h2>Verification</h2>
      <ul>
        <li>Command, visual check, or manual flow verified.</li>
      </ul>
    </section>

    <details>
      <summary>Implementation Notes</summary>
      <p>Longer notes go here.</p>
    </details>

    <details>
      <summary>Files Changed</summary>
      <ul>
        <li><code>path/to/file</code></li>
      </ul>
    </details>
  </article>
</main>
</body>
</html>
```

If the report includes a before/after or additional-screenshot gallery, constrain images inside their grid cells so narrow browser windows do not overflow:

```css
.shot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 14px;
  align-items: start;
}

.shot-grid figure {
  min-width: 0;
  margin: 0;
}

.shot-grid img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
```

## Image Lightbox Requirements

Any task-report HTML page or report index that renders screenshots or SVG images must load the shared lightweight lightbox helper:

```html
<script src="../../../assets/task-report-lightbox.js" defer></script>
```

Adjust the relative path from the HTML file to `docs/task-reports/assets/task-report-lightbox.js`. The helper opens clicked images in a simple backdrop with zoom controls, reset, close, wheel zoom, and drag-to-pan behavior. This includes month index thumbnails, where image clicks should preview the image while the rest of the card remains a normal report link.

Screenshot assets meant for inspection should preserve enough source pixels for zooming. Capture desktop report images at least `1920x1080` when the source view can support it. Capture narrow/mobile screenshots at device-pixel density when possible, for example a `390x700` viewport saved at `2x` as `780x1400`. Avoid using a screenshot of an already-downscaled screenshot as the primary evidence image.

## Index Page Requirements

Top-level `docs/task-reports/index.html`:

- Link to every year.
- Include a short explanation of the task report system.
- Optionally feature the latest 3-6 reports.

Year index `docs/task-reports/YYYY/index.html`:

- Link to every month in that year.
- Optionally feature notable reports from the year.

Month index `docs/task-reports/YYYY/MM/index.html`:

- Link to every report in that month.
- Use visual cards with a thumbnail, date, title, one-sentence summary, and tags.
- Sort newest first.

## Workflow For Agents

1. Finish the task implementation and normal verification.
2. Decide whether the task deserves a report using the criteria at the top of this file.
3. Capture or reuse relevant screenshots. For UI work, include before and after when available.
4. Create the report directory under `docs/task-reports/YYYY/MM/`.
5. Add assets under the report `assets/` directory.
6. Create the report `index.html` using the required content sections.
7. Update the month index with a card for the report.
8. Update the year index if the month is new.
9. Update the top-level index if the year is new or if the latest-report list is present.
