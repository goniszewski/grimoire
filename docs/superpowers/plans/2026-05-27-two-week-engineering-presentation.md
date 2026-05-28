# Two-Week Engineering Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone interactive HTML presentation summarizing the Little Imp features, fixes, key decisions, and validation work completed from 2026-05-13 through 2026-05-27.

**Architecture:** Create one self-contained file under `docs/presentations/` with inline CSS, inline JavaScript, and static presentation data. The deck uses semantic slide sections, DOM-only controls, accessible keyboard navigation, filterable workstream cards, expandable technical notes, and CSS/SVG visualizations.

**Tech Stack:** Plain HTML, CSS, JavaScript DOM APIs, inline SVG, local Node checks, optional Playwright browser verification through the repository's existing dev dependency.

---

## File Structure

- Create: `docs/presentations/little-imp-two-week-engineering-update.html`
  - Owns all presentation markup, styling, data, and interaction.
  - Must not reference external scripts, stylesheets, fonts, images, or network assets.
- No app source files should be modified.
- No persistent verification script is required; verification uses one-off shell/Node commands.

## Task 1: Create The Static Presentation Shell

**Files:**
- Create: `docs/presentations/little-imp-two-week-engineering-update.html`

- [ ] **Step 1: Create the presentations directory**

Run:

```bash
mkdir -p docs/presentations
```

Expected: command exits successfully and `docs/presentations/` exists.

- [ ] **Step 2: Add the initial HTML skeleton**

Create `docs/presentations/little-imp-two-week-engineering-update.html` with this structure:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Little Imp - Two-Week Engineering Update</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f1418;
        --panel: #172026;
        --panel-strong: #202c34;
        --text: #edf4f7;
        --muted: #9eb0bb;
        --line: #31434e;
        --blue: #6fb6ff;
        --green: #8adf9f;
        --amber: #f1c86b;
        --red: #ff8c7a;
        --ink: #101417;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      main { min-height: 100vh; }
      .slide {
        display: none;
        min-height: 100vh;
        padding: 88px clamp(24px, 5vw, 72px) 96px;
      }
      .slide.is-active { display: grid; align-content: center; gap: 28px; }
    </style>
  </head>
  <body>
    <nav class="deck-nav" aria-label="Presentation navigation">
      <button type="button" data-action="prev">Previous</button>
      <select aria-label="Jump to slide" data-jump></select>
      <button type="button" data-action="next">Next</button>
      <span data-counter>1 / 1</span>
    </nav>
    <main id="deck" aria-live="polite"></main>
    <script>
      const slides = [];
      const deck = document.querySelector("#deck");
      const counter = document.querySelector("[data-counter]");
      let activeIndex = 0;
    </script>
  </body>
</html>
```

- [ ] **Step 3: Commit the shell**

Run:

```bash
git add docs/presentations/little-imp-two-week-engineering-update.html
git commit -m "docs: add engineering update presentation shell"
```

Expected: a commit is created containing only the new presentation shell.

## Task 2: Add Contributor-Facing Presentation Data

**Files:**
- Modify: `docs/presentations/little-imp-two-week-engineering-update.html`

- [ ] **Step 1: Add workstream and evidence data**

Inside the `<script>` block, define these data structures before rendering:

```js
const workstreams = [
  {
    id: "contracts",
    label: "API Contracts",
    accent: "blue",
    summary: "Daemon-owned schemas now drive generated docs and frontend DTOs.",
    features: ["Source-of-truth API contract", "Generated API.md and docs/api-contract.json", "Frontend client types derived from shared contract"],
    fixes: ["Removed stale Settings shape casts", "Prevented API/frontend schema drift"],
    evidence: ["docs:api:check", "frontend API contract test"]
  },
  {
    id: "ai",
    label: "AI Runtime",
    accent: "green",
    summary: "Persisted Settings became the runtime source for LLM and embedding execution.",
    features: ["OpenAI, Ollama, Anthropic, OpenRouter, DeepSeek, custom OpenAI-compatible LLMs", "OpenAI, Ollama, and custom OpenAI-compatible embeddings", "Provider-aware connectivity tests"],
    fixes: ["Degraded mode reflects effective runtime capability", "Redacted secrets are never saved back as literal placeholders"],
    evidence: ["provider request-shape tests", "npm run check"]
  },
  {
    id: "backup",
    label: "Backup & Restore",
    accent: "green",
    summary: "Backup moved from useful snapshotting to safer verification, encryption, rollback, and restart recovery.",
    features: ["Packaged backup CLI", "In-app backup verification", "Encrypted package create/verify/restore", "Post-restore restart and rollback UX"],
    fixes: ["Checksum-required restore", "Temporary restored database migrations", "Rollback copy before replacement"],
    evidence: ["backup integration tests", "Settings restore tests"]
  },
  {
    id: "distribution",
    label: "Distribution",
    accent: "blue",
    summary: "Release artifacts became the shared substrate for install, Homebrew, and upgrade paths.",
    features: ["Signed release archive packaging", "One-command installer", "Homebrew formula path", "Packaged upgrade flow"],
    fixes: ["Unsafe archive member rejection", "macOS metadata sidecar exclusion", "Loopback-only Docker publishing"],
    evidence: ["release:validate", "installer matrix", "installed-app smoke"]
  },
  {
    id: "recovery",
    label: "Pipeline Recovery",
    accent: "amber",
    summary: "Failed ingestion, enrichment, and embedding work became visible and retryable.",
    features: ["Library reprocess jobs", "Failed-only retry mode", "Embedding-only regeneration", "Bookmark-level failure guidance"],
    fixes: ["Queue retry persistence", "Manual edits preserved by default"],
    evidence: ["daemon pipeline tests", "PipelineRecoveryPanel tests"]
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    accent: "amber",
    summary: "Local support bundles expose health and environment state without telemetry.",
    features: ["GET /diagnostics", "littleimp diagnostics", "Settings diagnostics copy/export"],
    fixes: ["API keys, PIN hashes, S3 secrets, and backup passwords redacted"],
    evidence: ["diagnostics integration tests", "Settings diagnostics tests"],
    status: "in workspace"
  },
  {
    id: "validation",
    label: "Validation",
    accent: "green",
    summary: "Release confidence shifted from source checks to installed-artifact checks.",
    features: ["Installed-app E2E smoke", "Linux installer matrix", "MVP evidence audit", "CI/local quality gates"],
    fixes: ["Release archive portability bug", "Stale task and roadmap contradictions"],
    evidence: ["152 frontend tests", "359 daemon tests", "npm run test:e2e:installed"]
  }
];

const activity = [
  { date: "2026-05-13", commits: 6, theme: "runtime, contracts, Docker, backup safety" },
  { date: "2026-05-14", commits: 1, theme: "release docs alignment" },
  { date: "2026-05-15", commits: 6, theme: "backup CLI, queue retries, release validation" },
  { date: "2026-05-18", commits: 5, theme: "AI providers, updates, frontend bundle" },
  { date: "2026-05-19", commits: 1, theme: "daemon update service" },
  { date: "2026-05-20", commits: 4, theme: "in-app updates, encrypted backups, MVP audit" },
  { date: "2026-05-26", commits: 4, theme: "release packaging and upgrade flow" },
  { date: "2026-05-27", commits: 7, theme: "installer validation, recovery UX, diagnostics" }
];
```

Expected: the data encodes the approved spec scope and labels diagnostics as current workspace work.

- [ ] **Step 2: Add decision data**

Add this `decisions` array:

```js
const decisions = [
  {
    stream: "contracts",
    title: "Make the daemon contract authoritative",
    choice: "Route schemas generate docs and frontend types instead of maintaining parallel shapes.",
    consequence: "Settings, backup, search, suggestions, and timeline integrations now fail at type/doc drift time instead of at runtime."
  },
  {
    stream: "ai",
    title: "Persisted Settings drive runtime execution",
    choice: "Environment variables remain install-time defaults; saved Settings resolve live LLM and embedding capability.",
    consequence: "Users can change providers in the app and have ingestion, search, MCP, and organization behavior follow the same source."
  },
  {
    stream: "distribution",
    title: "Release archives are the install substrate",
    choice: "One-command install, manual archive install, Homebrew, and upgrade all consume checksum-verified packaged archives.",
    consequence: "The project can validate and reason about one artifact layout instead of each installer path inventing packaging rules."
  },
  {
    stream: "backup",
    title: "Restore stays explicit and restart-bound",
    choice: "Restore validates checksums, creates rollback data, replaces the database safely, and requires daemon restart before normal use.",
    consequence: "The UX is less magical but keeps the data-integrity model clear and reviewable for MVP."
  },
  {
    stream: "distribution",
    title: "Docker remains local-only by default",
    choice: "The container can bind internally to 0.0.0.0, but host publishing is loopback-only and remote exposure is documented as requiring external auth.",
    consequence: "The unauthenticated daemon trust boundary is consistent across native and Docker installs."
  },
  {
    stream: "recovery",
    title: "Recovery jobs preserve user edits",
    choice: "Reprocess and retry paths regenerate failed or provider-dependent work without overwriting manual titles, tags, categories, or notes by default.",
    consequence: "Fixing provider configuration no longer forces users to delete and recreate bookmarks."
  }
];
```

- [ ] **Step 3: Commit the content data**

Run:

```bash
git add docs/presentations/little-imp-two-week-engineering-update.html
git commit -m "docs: add engineering update presentation content"
```

Expected: a commit is created with static deck data only.

## Task 3: Render Slides And Visualizations

**Files:**
- Modify: `docs/presentations/little-imp-two-week-engineering-update.html`

- [ ] **Step 1: Add the render helpers**

Add these helpers to the script:

```js
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function workstreamCards() {
  return workstreams.map((stream) => `
    <article class="stream-card" data-stream="${stream.id}" data-accent="${stream.accent}">
      <div class="card-topline">
        <span>${escapeHtml(stream.label)}</span>
        ${stream.status ? `<mark>${escapeHtml(stream.status)}</mark>` : ""}
      </div>
      <h3>${escapeHtml(stream.summary)}</h3>
      <details>
        <summary>Feature and fix detail</summary>
        <h4>Features</h4>
        ${list(stream.features)}
        <h4>Notable fixes</h4>
        ${list(stream.fixes)}
        <h4>Evidence</h4>
        ${list(stream.evidence)}
      </details>
    </article>
  `).join("");
}

function activityBars() {
  const max = Math.max(...activity.map((item) => item.commits));
  return activity.map((item) => `
    <li class="activity-row">
      <time>${escapeHtml(item.date)}</time>
      <span class="activity-bar" style="--size:${item.commits / max}">
        <b>${item.commits}</b>
      </span>
      <span>${escapeHtml(item.theme)}</span>
    </li>
  `).join("");
}
```

Expected: helpers are pure string builders and use `escapeHtml` for dynamic text.

- [ ] **Step 2: Define slide content**

Replace `const slides = [];` with:

```js
const slides = [
  {
    title: "Little Imp: two-week engineering update",
    eyebrow: "2026-05-13 to 2026-05-27",
    stream: "all",
    body: `
      <div class="hero-grid">
        <div>
          <p class="lede">The last two weeks moved Little Imp from beta-capable source checkout to a release-ready local-first app with safer data recovery, repeatable artifacts, expanded AI configuration, and installed-app validation.</p>
          <div class="metric-row">
            <div><b>34</b><span>commits on develop</span></div>
            <div><b>19</b><span>feature commits</span></div>
            <div><b>7</b><span>engineering workstreams</span></div>
          </div>
        </div>
        <aside class="callout strong">Main theme: reduce release risk by making behavior explicit, verifiable, and recoverable.</aside>
      </div>
    `
  },
  {
    title: "Workstream map",
    eyebrow: "Features, fixes, and evidence",
    stream: "all",
    body: `<div class="filter-row" data-filters></div><div class="stream-grid">${workstreamCards()}</div>`
  },
  {
    title: "Commit rhythm",
    eyebrow: "Activity by date",
    stream: "validation",
    body: `<ol class="activity-list">${activityBars()}</ol>`
  },
  {
    title: "Key architecture decisions",
    eyebrow: "Choices that reduce drift and risk",
    stream: "contracts",
    body: `<div class="decision-grid">${decisions.map((decision) => `
      <article class="decision-card" data-stream="${decision.stream}">
        <h3>${escapeHtml(decision.title)}</h3>
        <p><strong>Choice:</strong> ${escapeHtml(decision.choice)}</p>
        <p><strong>Consequence:</strong> ${escapeHtml(decision.consequence)}</p>
      </article>
    `).join("")}</div>`
  },
  {
    title: "Contract flow",
    eyebrow: "Daemon schema to contributor confidence",
    stream: "contracts",
    body: `
      <div class="flow">
        <div>Daemon route schemas</div><span>generate</span>
        <div>API.md + JSON contract</div><span>type</span>
        <div>Frontend API client</div><span>guard</span>
        <div>Settings and E2E fixtures</div>
      </div>
      <p class="slide-note">This removed frontend-local DTO drift and turned API docs into a checked artifact.</p>
    `
  },
  {
    title: "Runtime AI became configurable for real",
    eyebrow: "Settings now affect execution paths",
    stream: "ai",
    body: `
      <div class="provider-board">
        <span>OpenAI</span><span>Ollama</span><span>Anthropic</span><span>OpenRouter</span><span>DeepSeek</span><span>Custom compatible</span>
      </div>
      <p class="slide-note">Ingestion, semantic search, related bookmarks, MCP search, and organization suggestions resolve the same effective runtime settings.</p>
    `
  },
  {
    title: "Backup and restore safety model",
    eyebrow: "Verify before replace, rollback before restart",
    stream: "backup",
    body: `
      <div class="flow vertical">
        <div>Snapshot + manifest + checksums + non-secret settings</div>
        <div>Verify local or encrypted package</div>
        <div>Run restored DB migrations in temp location</div>
        <div>Create rollback copy</div>
        <div>Replace database and require daemon restart</div>
      </div>
    `
  },
  {
    title: "Distribution pipeline",
    eyebrow: "One artifact layout, multiple install paths",
    stream: "distribution",
    body: `
      <div class="flow">
        <div>package:release</div><span>produces</span>
        <div>macOS/Linux archives + checksums</div><span>consumed by</span>
        <div>install.sh, Homebrew, update install</div><span>validated by</span>
        <div>release and installed-app smoke</div>
      </div>
    `
  },
  {
    title: "Recovery UX",
    eyebrow: "Failures became actionable",
    stream: "recovery",
    body: `
      <div class="risk-map">
        <article><b>Before</b><span>Provider or extraction failures were visible mainly as degraded data.</span></article>
        <article><b>After</b><span>Users can retry failed work, reprocess libraries, regenerate embeddings, and preserve manual edits.</span></article>
      </div>
    `
  },
  {
    title: "Diagnostics without telemetry",
    eyebrow: "Current workspace work",
    stream: "diagnostics",
    body: `
      <div class="risk-map">
        <article><b>Included</b><span>Version, platform, install mode, paths, health, queue, provider, backup, and log locations.</span></article>
        <article><b>Omitted</b><span>API keys, PIN hashes, S3 secrets, backup passwords, and telemetry.</span></article>
      </div>
    `
  },
  {
    title: "Verification coverage",
    eyebrow: "Evidence across source, docs, artifacts, and installs",
    stream: "validation",
    body: `
      <div class="coverage-board">
        <div><b>152</b><span>frontend tests</span></div>
        <div><b>359</b><span>daemon tests</span></div>
        <div><b>docs</b><span>API drift checks</span></div>
        <div><b>artifact</b><span>release validation</span></div>
        <div><b>install</b><span>installed-app smoke</span></div>
        <div><b>matrix</b><span>Ubuntu and Debian installer validation</span></div>
      </div>
    `
  },
  {
    title: "Contributor takeaways",
    eyebrow: "Where review attention should go next",
    stream: "all",
    body: `
      <div class="takeaways">
        <p>Shared contracts, runtime settings, release archives, and explicit recovery paths are now load-bearing architecture.</p>
        <p>Future changes should preserve the same principle: one source of truth, local-first safety, no implicit network trust, and artifact-level validation before release claims.</p>
      </div>
    `
  }
];
```

Expected: deck has 12 slides and covers every approved spec section.

- [ ] **Step 3: Add rendering function**

Add:

```js
function renderSlides() {
  deck.innerHTML = slides.map((slide, index) => `
    <section class="slide${index === 0 ? " is-active" : ""}" data-slide="${index}" data-stream="${slide.stream}" tabindex="-1" aria-labelledby="slide-title-${index}">
      <p class="eyebrow">${escapeHtml(slide.eyebrow)}</p>
      <h1 id="slide-title-${index}">${escapeHtml(slide.title)}</h1>
      ${slide.body}
    </section>
  `).join("");
}
```

- [ ] **Step 4: Commit rendered content**

Run:

```bash
git add docs/presentations/little-imp-two-week-engineering-update.html
git commit -m "docs: render engineering update slides"
```

Expected: a commit is created and the file contains all slide sections.

## Task 4: Add Styling And Responsive Layout

**Files:**
- Modify: `docs/presentations/little-imp-two-week-engineering-update.html`

- [ ] **Step 1: Expand CSS for the deck UI**

Add styles for navigation, slides, grids, flow diagrams, cards, filters, and print:

```css
.deck-nav {
  position: fixed;
  inset: 16px 16px auto;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  background: rgba(15, 20, 24, 0.9);
  backdrop-filter: blur(12px);
}
.deck-nav button,
.deck-nav select,
.filter-row button {
  min-height: 38px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  border-radius: 6px;
  padding: 0 12px;
}
.deck-nav button:focus-visible,
.deck-nav select:focus-visible,
.filter-row button:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 2px;
}
.eyebrow {
  margin: 0;
  color: var(--green);
  text-transform: uppercase;
  letter-spacing: 0;
  font-size: 0.82rem;
  font-weight: 700;
}
h1 {
  max-width: 980px;
  margin: 0;
  font-size: clamp(2.4rem, 6vw, 5.8rem);
  line-height: 0.95;
  letter-spacing: 0;
}
.lede {
  max-width: 900px;
  font-size: clamp(1.25rem, 2.4vw, 2rem);
  line-height: 1.35;
}
.metric-row,
.coverage-board,
.stream-grid,
.decision-grid,
.risk-map,
.provider-board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}
.metric-row div,
.coverage-board div,
.stream-card,
.decision-card,
.risk-map article,
.callout {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
}
.metric-row b,
.coverage-board b {
  display: block;
  font-size: clamp(2rem, 4vw, 4rem);
  line-height: 1;
}
.stream-card[data-accent="blue"] { border-top: 4px solid var(--blue); }
.stream-card[data-accent="green"] { border-top: 4px solid var(--green); }
.stream-card[data-accent="amber"] { border-top: 4px solid var(--amber); }
.activity-list {
  display: grid;
  gap: 14px;
  padding: 0;
  list-style: none;
}
.activity-row {
  display: grid;
  grid-template-columns: 120px minmax(120px, 1fr) minmax(180px, 2fr);
  gap: 14px;
  align-items: center;
}
.activity-bar {
  display: block;
  min-height: 34px;
  width: calc(var(--size) * 100%);
  min-width: 42px;
  border-radius: 6px;
  background: var(--blue);
  color: var(--ink);
  padding: 7px 10px;
}
.flow {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  align-items: stretch;
}
.flow div {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
  background: var(--panel-strong);
}
.flow span {
  align-self: center;
  color: var(--amber);
  font-weight: 700;
}
.flow.vertical {
  grid-template-columns: 1fr;
  max-width: 820px;
}
.slide-note {
  color: var(--muted);
  max-width: 900px;
  font-size: 1.1rem;
}
@media (max-width: 760px) {
  .slide { padding: 104px 18px 72px; }
  .deck-nav { inset: 8px; flex-wrap: wrap; }
  .activity-row { grid-template-columns: 1fr; }
}
@media print {
  .deck-nav { display: none; }
  .slide { display: block; min-height: 100vh; break-after: page; }
}
```

Expected: layout is readable at desktop and mobile widths, with no card nesting.

- [ ] **Step 2: Commit styling**

Run:

```bash
git add docs/presentations/little-imp-two-week-engineering-update.html
git commit -m "docs: style engineering update deck"
```

Expected: a commit is created with CSS-only presentation improvements.

## Task 5: Add Navigation, Filters, And Expandable Detail Behavior

**Files:**
- Modify: `docs/presentations/little-imp-two-week-engineering-update.html`

- [ ] **Step 1: Add slide navigation functions**

Add:

```js
function showSlide(index) {
  const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
  const slideElements = [...document.querySelectorAll(".slide")];
  slideElements.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === nextIndex);
  });
  activeIndex = nextIndex;
  counter.textContent = `${activeIndex + 1} / ${slides.length}`;
  document.querySelector("[data-jump]").value = String(activeIndex);
  slideElements[activeIndex]?.focus({ preventScroll: true });
}

function renderJumpMenu() {
  const jump = document.querySelector("[data-jump]");
  jump.innerHTML = slides.map((slide, index) => `<option value="${index}">${index + 1}. ${escapeHtml(slide.title)}</option>`).join("");
}

function bindNavigation() {
  document.querySelector("[data-action='prev']").addEventListener("click", () => showSlide(activeIndex - 1));
  document.querySelector("[data-action='next']").addEventListener("click", () => showSlide(activeIndex + 1));
  document.querySelector("[data-jump]").addEventListener("change", (event) => showSlide(Number(event.target.value)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showSlide(activeIndex - 1);
    if (event.key === "ArrowRight") showSlide(activeIndex + 1);
    if (event.key === "Home") showSlide(0);
    if (event.key === "End") showSlide(slides.length - 1);
  });
}
```

Expected: controls and keyboard navigation clamp to valid slide indexes.

- [ ] **Step 2: Add filters**

Add:

```js
let activeFilter = "all";

function renderFilters() {
  const containers = document.querySelectorAll("[data-filters]");
  containers.forEach((container) => {
    container.innerHTML = [
      `<button type="button" data-filter="all">All</button>`,
      ...workstreams.map((stream) => `<button type="button" data-filter="${stream.id}">${escapeHtml(stream.label)}</button>`)
    ].join("");
  });
}

function applyFilter(filter) {
  activeFilter = filter || "all";
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.toggleAttribute("aria-pressed", button.dataset.filter === activeFilter);
  });
  document.querySelectorAll("[data-stream]").forEach((element) => {
    const stream = element.dataset.stream;
    const relevant = activeFilter === "all" || stream === activeFilter || stream === "all";
    element.classList.toggle("is-dimmed", !relevant);
  });
}

function bindFilters() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    applyFilter(button.dataset.filter);
  });
}
```

Expected: filter buttons dim unrelated stream cards and decisions without hiding content from keyboard users.

- [ ] **Step 3: Initialize the deck**

At the end of the script, add:

```js
renderSlides();
renderJumpMenu();
renderFilters();
bindNavigation();
bindFilters();
applyFilter("all");
showSlide(0);
```

- [ ] **Step 4: Commit interactions**

Run:

```bash
git add docs/presentations/little-imp-two-week-engineering-update.html
git commit -m "docs: add interactive deck navigation"
```

Expected: a commit is created and the deck is keyboard navigable.

## Task 6: Verify The Presentation

**Files:**
- Inspect: `docs/presentations/little-imp-two-week-engineering-update.html`

- [ ] **Step 1: Run static checks**

Run:

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('docs/presentations/little-imp-two-week-engineering-update.html','utf8'); if((html.match(/title:/g)||[]).length < 12) throw new Error('expected at least 12 slides'); if(/https?:\\/\\//.test(html)) throw new Error('external URL found'); for (const token of ['data-action=\"prev\"','data-action=\"next\"','data-jump','data-filters','ArrowRight','@media print']) { if(!html.includes(token)) throw new Error('missing '+token); } console.log('static presentation checks passed');"
```

Expected output:

```text
static presentation checks passed
```

- [ ] **Step 2: Verify with Playwright if browsers are installed**

Run:

```bash
node -e "const { chromium } = require('playwright'); const path = require('path'); (async () => { const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await page.goto('file://' + path.resolve('docs/presentations/little-imp-two-week-engineering-update.html')); await page.keyboard.press('ArrowRight'); const counter = await page.locator('[data-counter]').textContent(); if (!counter.includes('2 /')) throw new Error('keyboard navigation failed: ' + counter); const backupFilter = page.locator('[aria-label=\"Filter workstreams\"] [data-filter=\"backup\"]'); await backupFilter.click(); const pressed = await backupFilter.getAttribute('aria-pressed'); if (pressed !== 'true') throw new Error('filter did not activate'); await page.screenshot({ path: '/tmp/little-imp-two-week-engineering-update.png', fullPage: true }); await browser.close(); console.log('browser presentation checks passed'); })();"
```

Expected output:

```text
browser presentation checks passed
```

If this fails because the Playwright browser binary is missing, run `npm run test:e2e:install` only with user approval because it downloads browser dependencies. If it passes and creates `/tmp/little-imp-two-week-engineering-update.png`, inspect the screenshot; no repository cleanup is required for the temporary preview image.

- [ ] **Step 3: Check git diff scope**

Run:

```bash
git diff --name-status
```

Expected: the only new implementation file for this task is `docs/presentations/little-imp-two-week-engineering-update.html`; pre-existing diagnostics and documentation changes may still appear and must not be reverted.

- [ ] **Step 4: Final commit**

Run:

```bash
git add docs/presentations/little-imp-two-week-engineering-update.html
git commit -m "docs: add interactive engineering update deck"
```

Expected: commit succeeds after pre-commit checks. If there are no uncommitted deck changes because previous task commits already captured the final file, skip this step and report the existing commits.

## Self-Review Checklist

- Approved spec requirement "single static HTML file" is covered by Tasks 1-5.
- Approved spec requirement "technical contributor audience" is covered by Task 2 content and Task 3 slides.
- Approved spec requirement "visualizations" is covered by Task 3 and Task 4.
- Approved spec requirement "key decisions" is covered by Task 2 decisions and Task 3 decision slide.
- Approved spec requirement "keyboard navigation, filters, expandable notes, jump menu, progress" is covered by Task 5 and native `<details>` elements in Task 3.
- Approved spec requirement "print-friendly layout" is covered by Task 4.
- Approved spec requirement "local verification" is covered by Task 6.
- No app runtime files are modified by this plan.
