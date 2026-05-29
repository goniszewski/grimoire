import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "docs", "presentations", "ui-ux-audit-assets");
const appUrl = process.env.UI_AUDIT_BASE_URL ?? "http://localhost:8080";
const daemonOrigin = "http://127.0.0.1:3210";
const fixedNow = new Date("2026-05-29T09:00:00.000Z");

function isoDaysAgo(days, hours = 0) {
  return new Date(fixedNow.getTime() - (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

function svgData(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="${color}"/><text x="16" y="21" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="700" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const categories = [
  {
    id: "cat-product",
    name: "Product Research",
    parent_id: null,
    created_at: isoDaysAgo(50),
    updated_at: isoDaysAgo(3),
    bookmark_count: 4,
    children: [
      {
        id: "cat-ux",
        name: "UX Patterns",
        parent_id: "cat-product",
        created_at: isoDaysAgo(45),
        updated_at: isoDaysAgo(2),
        bookmark_count: 3,
        children: [],
      },
    ],
  },
  {
    id: "cat-engineering",
    name: "Engineering",
    parent_id: null,
    created_at: isoDaysAgo(44),
    updated_at: isoDaysAgo(1),
    bookmark_count: 4,
    children: [
      {
        id: "cat-data",
        name: "Data Systems",
        parent_id: "cat-engineering",
        created_at: isoDaysAgo(38),
        updated_at: isoDaysAgo(6),
        bookmark_count: 2,
        children: [],
      },
    ],
  },
  {
    id: "cat-ops",
    name: "Operations",
    parent_id: null,
    created_at: isoDaysAgo(30),
    updated_at: isoDaysAgo(1),
    bookmark_count: 4,
    children: [],
  },
];

const bookmarks = [
  {
    id: "bm-001",
    url: "https://www.nngroup.com/articles/command-palette/",
    domain: "nngroup.com",
    title: "Designing Command Palettes for Fast Recall",
    description: "Patterns for search-first navigation, keyboard recall, and progressive disclosure in productivity tools.",
    status: "indexed",
    category_id: "cat-ux",
    favicon_url: svgData("NN", "#0f766e"),
    screenshot_url: null,
    is_pinned: 1,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: "Useful for the AI palette. Consider grouping commands by intent.",
    created_at: isoDaysAgo(1, 2),
    updated_at: isoDaysAgo(1),
    tags: ["ux", "search", "product"],
  },
  {
    id: "bm-002",
    url: "https://www.radix-ui.com/primitives/docs/components/dialog",
    domain: "radix-ui.com",
    title: "Radix Dialog Accessibility Notes",
    description: "Reference for modal focus management, escape behavior, and accessible naming.",
    status: "ai_enriched",
    category_id: "cat-engineering",
    favicon_url: svgData("RX", "#7c3aed"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: isoDaysAgo(1),
    notes: "Good fit for checking Add, Import, Preferences, and restore dialogs.",
    created_at: isoDaysAgo(2),
    updated_at: isoDaysAgo(1),
    tags: ["accessibility", "react", "dialogs"],
  },
  {
    id: "bm-003",
    url: "https://sqlite.org/fts5.html",
    domain: "sqlite.org",
    title: "SQLite FTS5 Ranking Strategies",
    description: "Deep reference for local keyword search ranking and tokenizer tradeoffs.",
    status: "indexed",
    category_id: "cat-data",
    favicon_url: svgData("DB", "#2563eb"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: isoDaysAgo(3, 5),
    updated_at: isoDaysAgo(2),
    tags: ["sqlite", "search", "local-first"],
  },
  {
    id: "bm-004",
    url: "https://www.inkandswitch.com/local-first/",
    domain: "inkandswitch.com",
    title: "Local-first Software Principles",
    description: "A design lens for ownership, instant interaction, and network-independent workflows.",
    status: "fetched",
    category_id: "cat-product",
    favicon_url: svgData("IF", "#0369a1"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: isoDaysAgo(4),
    updated_at: isoDaysAgo(4),
    tags: ["local-first", "product"],
  },
  {
    id: "bm-005",
    url: "https://playwright.dev/docs/test-snapshots",
    domain: "playwright.dev",
    title: "Playwright Visual Regression Guide",
    description: "Covers deterministic screenshots, snapshot review, and regression testing for UI polish work.",
    status: "extracted",
    category_id: "cat-engineering",
    favicon_url: svgData("PW", "#16a34a"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: isoDaysAgo(2),
    notes: null,
    created_at: isoDaysAgo(6),
    updated_at: isoDaysAgo(5),
    tags: ["testing", "visual-regression"],
  },
  {
    id: "bm-006",
    url: "https://basecamp.com/shapeup",
    domain: "basecamp.com",
    title: "Backups That Users Trust",
    description: "Notes on risk communication, reversibility, and restore confirmation language.",
    status: "indexed",
    category_id: "cat-ops",
    favicon_url: svgData("BU", "#be123c"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: "Reference when rewriting backup and restore flows.",
    created_at: isoDaysAgo(8),
    updated_at: isoDaysAgo(7),
    tags: ["backup", "trust", "copy"],
  },
  {
    id: "bm-007",
    url: "https://developers.cloudflare.com/r2/",
    domain: "developers.cloudflare.com",
    title: "S3 Compatible Storage Matrix",
    description: "Provider-specific S3 compatibility details for remote backup setup and diagnostics.",
    status: "saved",
    category_id: "cat-ops",
    favicon_url: svgData("R2", "#ea580c"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: isoDaysAgo(10),
    updated_at: isoDaysAgo(10),
    tags: ["backup", "s3", "operations"],
  },
  {
    id: "bm-008",
    url: "https://www.electronjs.org/docs/latest/tutorial/security",
    domain: "electronjs.org",
    title: "Release Checklist for Desktop Apps",
    description: "Security and packaging checks that can inform release readiness messaging.",
    status: "indexed",
    category_id: "cat-ops",
    favicon_url: svgData("EL", "#0891b2"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: isoDaysAgo(12),
    updated_at: isoDaysAgo(10),
    tags: ["release", "security"],
  },
  {
    id: "bm-009",
    url: "https://material.io/design/color/the-color-system.html",
    domain: "material.io",
    title: "A Practical Guide to Color Systems",
    description: "Explains role-based color tokens, contrast, and semantic color systems.",
    status: "ai_enriched",
    category_id: "cat-ux",
    favicon_url: svgData("CO", "#db2777"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: isoDaysAgo(14),
    updated_at: isoDaysAgo(13),
    tags: ["color", "design-system", "ux"],
  },
  {
    id: "bm-010",
    url: "https://www.atlassian.com/incident-management/kpis/postmortem",
    domain: "atlassian.com",
    title: "Failure Recovery UX Patterns",
    description: "Ideas for communicating failures, retry affordances, and recovery paths without overwhelming users.",
    status: "extracted",
    category_id: "cat-product",
    favicon_url: svgData("FR", "#dc2626"),
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: "Pipeline failure state should feel actionable, not alarming.",
    created_at: isoDaysAgo(16),
    updated_at: isoDaysAgo(15),
    tags: ["recovery", "ux", "errors"],
  },
];

const archivedBookmarks = [
  {
    ...bookmarks[3],
    id: "bm-arch-001",
    title: "Archived: Local-first Reading List",
    is_archived: 1,
    created_at: isoDaysAgo(40),
  },
  {
    ...bookmarks[4],
    id: "bm-arch-002",
    title: "Archived: Snapshot Testing Notes",
    is_archived: 1,
    created_at: isoDaysAgo(55),
  },
  {
    ...bookmarks[5],
    id: "bm-arch-003",
    title: "Archived: Restore Copy Draft",
    is_archived: 1,
    created_at: isoDaysAgo(64),
  },
];

const trashedBookmarks = [
  {
    ...bookmarks[6],
    id: "bm-trash-001",
    title: "Draft: Old R2 Setup Notes",
    is_trashed: 1,
    trashed_at: isoDaysAgo(2),
    created_at: isoDaysAgo(25),
  },
  {
    ...bookmarks[7],
    id: "bm-trash-002",
    title: "Duplicate Release Checklist",
    is_trashed: 1,
    trashed_at: isoDaysAgo(24),
    created_at: isoDaysAgo(28),
  },
  {
    ...bookmarks[8],
    id: "bm-trash-003",
    title: "Stale Color Palette Draft",
    is_trashed: 1,
    trashed_at: isoDaysAgo(29),
    created_at: isoDaysAgo(32),
  },
];

const extraDomains = [
  "github.com",
  "developer.apple.com",
  "developer.mozilla.org",
  "react.dev",
  "tanstack.com",
  "tailwindcss.com",
  "lucide.dev",
  "shadcn-ui.com",
  "openai.com",
  "anthropic.com",
  "linear.app",
  "figma.com",
  "stripe.com",
  "vercel.com",
  "cloudflare.com",
  "supabase.com",
  "docker.com",
  "homebrew.sh",
  "sqlitebrowser.org",
  "obsidian.md",
  "raycast.com",
  "notion.so",
].map((domain, index) => ({ domain, count: 1 + (index % 4) }));

const domainRows = [
  ...Array.from(
    bookmarks.reduce((map, bookmark) => {
      map.set(bookmark.domain, (map.get(bookmark.domain) ?? 0) + 1);
      return map;
    }, new Map()),
    ([domain, count]) => ({ domain, count })
  ),
  ...extraDomains,
];

const suggestions = [
  {
    id: "sug-001",
    bookmarkId: null,
    type: "new_subcategory",
    value: "Create subcategory 'Interaction Patterns' under Product Research for 7 related bookmarks.",
    metadata: {},
    confidence: 0.86,
    status: "pending",
    created_at: isoDaysAgo(0, 2),
    resolved_at: null,
  },
  {
    id: "sug-002",
    bookmarkId: null,
    type: "merge_categories",
    value: "Merge 'Visual Design' into 'UX Patterns' because 9 tags overlap.",
    metadata: {},
    confidence: 0.72,
    status: "pending",
    created_at: isoDaysAgo(0, 4),
    resolved_at: null,
  },
  {
    id: "sug-003",
    bookmarkId: "bm-arch-002",
    type: "duplicate_bookmark",
    value: "Duplicate detected: 'Archived: Snapshot Testing Notes' appears to overlap with Playwright Visual Regression Guide.",
    metadata: {},
    confidence: 0.64,
    status: "pending",
    created_at: isoDaysAgo(1),
    resolved_at: null,
  },
];

const timelineEvents = [
  {
    id: "event-001",
    type: "suggestion_accepted",
    description: "Accepted merge suggestion for Visual Design -> UX Patterns.",
    metadata: {},
    source: "user",
    created_at: isoDaysAgo(0, 1),
  },
  {
    id: "event-002",
    type: "category_merge_suggested",
    description: "Agent suggested merging Product Research and UX Patterns.",
    metadata: {},
    source: "agent",
    created_at: isoDaysAgo(0, 3),
  },
  {
    id: "event-003",
    type: "cluster_labeled",
    description: "Labeled a cluster of 12 bookmarks as Local-first Architecture.",
    metadata: {},
    source: "agent",
    created_at: isoDaysAgo(1),
  },
  {
    id: "event-004",
    type: "category_created",
    description: "Created category Operations.",
    metadata: {},
    source: "user",
    created_at: isoDaysAgo(3),
  },
  {
    id: "event-005",
    type: "duplicate_removed",
    description: "Removed duplicate bookmark from archived release notes.",
    metadata: {},
    source: "agent",
    created_at: isoDaysAgo(6),
  },
  {
    id: "event-006",
    type: "category_renamed",
    description: "Renamed 'Design' to 'UX Patterns'.",
    metadata: {},
    source: "user",
    created_at: isoDaysAgo(9),
  },
];

const backupEntries = [
  {
    name: "2026-05-29T08-00-00-000Z",
    path: "/Users/robert/Library/Application Support/Little Imp/backups/2026-05-29T08-00-00-000Z",
    size_bytes: 4_836_352,
    bookmark_count: 124,
    created_at: isoDaysAgo(0, 1),
    source: "local",
  },
  {
    name: "2026-05-28T03-00-00-000Z",
    path: "/Users/robert/Library/Application Support/Little Imp/backups/2026-05-28T03-00-00-000Z",
    size_bytes: 4_701_184,
    bookmark_count: 121,
    created_at: isoDaysAgo(1),
    source: "local",
  },
  {
    name: "remote/2026-05-27T03-00-00-000Z",
    path: "s3://little-imp-backups/remote/2026-05-27T03-00-00-000Z",
    size_bytes: 4_690_944,
    bookmark_count: 120,
    created_at: isoDaysAgo(2),
    source: "remote",
  },
];

function aggregateTags(rows) {
  const map = new Map();
  rows.forEach((bookmark) => {
    bookmark.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
  });
  return Array.from(map, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

function makeSettings(provider = "openai") {
  const llmEnabled = provider !== "none";
  return {
    ai: {
      provider,
      openai: { api_key: provider === "openai" ? "***" : "", model: "gpt-4o-mini" },
      ollama: { base_url: "http://localhost:11434", model: "llama3" },
      anthropic: { api_key: "", base_url: "https://api.anthropic.com", model: "claude-sonnet-4-6" },
      openrouter: { api_key: "", base_url: "https://openrouter.ai/api/v1", model: "~openai/gpt-latest" },
      openai_compatible: { api_key: "", base_url: "http://localhost:8000/v1", model: "custom-chat-model" },
      deepseek: { api_key: "", base_url: "https://api.deepseek.com", model: "deepseek-v4-flash" },
      embeddings: {
        provider: "openai",
        model: "text-embedding-3-small",
        openai_compatible: { api_key: "", base_url: "http://localhost:8000/v1", model: "custom-embedding-model" },
      },
    },
    app: {
      autostart: false,
      theme: "system",
      lock: { enabled: false, pin_hash: "" },
    },
    backup: {
      local: { destination_path: "/Users/robert/Library/Mobile Documents/com~apple~CloudDocs/Little Imp Backups" },
      schedule: { enabled: true, cron: "0 3 * * *", retention_count: 14 },
      s3: {
        endpoint: "https://example-account.r2.cloudflarestorage.com",
        bucket: "little-imp-backups",
        access_key: "",
        secret_key: "",
        region: "auto",
        prefix: "library/",
      },
    },
    runtime: {
      llm: {
        enabled: llmEnabled,
        provider,
        model: llmEnabled ? "gpt-4o-mini" : null,
        base_url: llmEnabled ? "https://api.openai.com/v1" : null,
      },
      embeddings: {
        enabled: provider !== "none",
        provider: "openai",
        model: "text-embedding-3-small",
        base_url: "https://api.openai.com/v1",
      },
      capabilities: {
        enrichment: llmEnabled,
        semantic_search: provider !== "none",
        related_bookmarks: provider !== "none",
        organization_agent: llmEnabled,
      },
    },
  };
}

function diagnostics(settings) {
  return {
    generated_at: fixedNow.toISOString(),
    version: "0.1.0-beta",
    platform: {
      os: "darwin",
      arch: "arm64",
      bun_version: "1.2.0",
      node_env: "development",
      host: "127.0.0.1",
      port: 3210,
    },
    install: { mode: "development" },
    paths: {
      data_dir: "/Users/robert/Library/Application Support/Little Imp",
      database_path: "/Users/robert/Library/Application Support/Little Imp/littleimp.db",
      config_file: "/Users/robert/Library/Application Support/Little Imp/settings.json",
      backup_dir: "/Users/robert/Library/Mobile Documents/com~apple~CloudDocs/Little Imp Backups",
      frontend_dist: path.join(repoRoot, "dist"),
      log_files: [
        { label: "daemon", path: "/Users/robert/Library/Logs/Little Imp/daemon.log" },
        { label: "worker", path: "/Users/robert/Library/Logs/Little Imp/worker.log" },
      ],
    },
    daemon: {
      status: "ok",
      uptime_ms: 482000,
      queue_size: 3,
      queue: { pending: 2, running: 1, done: 384, failed: 1 },
    },
    providers: {
      llm: {
        provider: settings.ai.provider,
        configured: settings.ai.provider !== "none",
        model: settings.runtime.llm.model,
        base_url: settings.runtime.llm.base_url,
      },
      embeddings: {
        provider: settings.ai.embeddings.provider,
        configured: settings.ai.provider !== "none",
        model: settings.ai.embeddings.model,
        base_url: settings.runtime.embeddings.base_url,
      },
    },
    backup: {
      local: { path: settings.backup.local.destination_path, is_custom: true, writable: true },
      schedule: { enabled: true, cron: "0 3 * * *", retention_count: 14, next_run_at: isoDaysAgo(-1) },
      s3: { configured: true, endpoint: settings.backup.s3.endpoint, bucket: settings.backup.s3.bucket, region: "auto", prefix: "library/" },
    },
    search: { keyword: true, semantic: true, hybrid: true },
    omitted_secrets: ["ai.openai.api_key", "backup.s3.access_key", "backup.s3.secret_key"],
  };
}

function listResponse(rows, total = rows.length) {
  return { data: rows, pagination: { total, limit: 200, offset: 0, has_more: false } };
}

function matchesSearch(bookmark, q) {
  const haystack = [bookmark.url, bookmark.domain, bookmark.title ?? "", bookmark.description ?? "", ...bookmark.tags]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function makeRestoreResult() {
  return {
    restored_at: isoDaysAgo(1),
    bookmark_count: 124,
    checksum_verified: true,
    rollback_path: "/Users/robert/Library/Application Support/Little Imp/rollback/2026-05-28T09-00-00-000Z",
    restart_required: true,
    restart_command: "little-imp daemon restart",
    health_url: `${daemonOrigin}/health`,
    rollback_instructions: [
      "Stop the daemon.",
      "Replace the active data directory with the rollback directory.",
      "Start the daemon and verify /health.",
    ],
  };
}

async function fulfillJson(route, json, status = 200) {
  await route.fulfill({ status, json });
}

async function installMocks(page, options = {}) {
  const activeRows = options.emptyLibrary ? [] : bookmarks;
  const settings = makeSettings(options.aiProvider ?? "openai");

  await page.route("https://www.google.com/s2/favicons**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: decodeURIComponent(svgData("LI", "#7c3aed").replace("data:image/svg+xml,", "")),
    })
  );

  await page.route(`${daemonOrigin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (pathname === "/health") {
      if (options.offline) return route.abort("connectionrefused");
      return fulfillJson(route, { status: "ok", version: "0.1.0-beta", uptime: 900000, queueSize: 3 });
    }

    if (pathname === "/settings" && method === "GET") return fulfillJson(route, { data: settings });
    if (pathname === "/settings" && method === "PUT") return fulfillJson(route, { data: settings });
    if (pathname === "/settings/test-ai") return fulfillJson(route, { ok: true, message: "Connected" });
    if (pathname === "/settings/test-s3") return fulfillJson(route, { ok: true, message: "Connected" });
    if (pathname === "/diagnostics") return fulfillJson(route, { data: diagnostics(settings) });
    if (pathname === "/updates/check") {
      return fulfillJson(route, {
        data: {
          current_version: "0.1.0-beta",
          update_available: true,
          source: "https://github.com/goniszewski/little-imp/releases",
          channel: "beta",
          latest: { version: "0.1.1-beta", tag: "v0.1.1-beta", url: "https://github.com/goniszewski/little-imp/releases/tag/v0.1.1-beta" },
        },
      });
    }

    if (pathname === "/categories" && method === "GET") return fulfillJson(route, { data: categories });
    if (pathname === "/categories" && method === "POST") {
      return fulfillJson(route, {
        data: { id: "cat-new", name: "Inbox", parent_id: null, created_at: fixedNow.toISOString(), updated_at: fixedNow.toISOString() },
      }, 201);
    }
    if (pathname.startsWith("/categories/") && method === "PUT") {
      const id = pathname.split("/").pop();
      const existing = categories.flatMap((item) => [item, ...item.children]).find((item) => item.id === id);
      return fulfillJson(route, { data: { ...(existing ?? categories[0]), ...(request.postDataJSON() ?? {}) } });
    }
    if (pathname.startsWith("/categories/") && method === "DELETE") return route.fulfill({ status: 204 });

    if (pathname === "/domains") return fulfillJson(route, { data: domainRows });
    if (pathname === "/tags") return fulfillJson(route, { data: aggregateTags(activeRows) });

    if (pathname === "/bookmarks" && method === "GET") {
      const totalOverride = options.bookmarkTotalOverride;
      if (url.searchParams.get("archived") === "true") return fulfillJson(route, listResponse(archivedBookmarks));
      let rows = activeRows;
      const tag = url.searchParams.get("tag");
      const domain = url.searchParams.get("domain");
      const category = url.searchParams.get("category");
      if (tag) rows = rows.filter((bookmark) => bookmark.tags.includes(tag));
      if (domain) rows = rows.filter((bookmark) => bookmark.domain === domain);
      if (category) rows = rows.filter((bookmark) => bookmark.category_id === category);
      return fulfillJson(route, listResponse(rows, totalOverride ?? rows.length));
    }
    if (pathname === "/bookmarks" && method === "POST") {
      const body = request.postDataJSON();
      const created = {
        ...bookmarks[0],
        id: "bm-created",
        url: body.url,
        domain: new URL(body.url).hostname,
        title: body.title ?? "Queued bookmark",
        description: null,
        status: "saved",
        tags: [],
        created_at: fixedNow.toISOString(),
        updated_at: fixedNow.toISOString(),
      };
      return fulfillJson(route, { data: created }, 201);
    }
    if (pathname === "/bookmarks/reprocess") {
      return fulfillJson(route, {
        data: { batch_id: "batch-ui-audit", mode: request.postDataJSON()?.mode ?? "all", enqueued: 7, skipped: 2, status_url: `${daemonOrigin}/reprocess/batch-ui-audit` },
      });
    }
    if (pathname.startsWith("/bookmarks/")) {
      const parts = pathname.split("/");
      const id = parts[2];
      const bookmark = [...activeRows, ...archivedBookmarks, ...trashedBookmarks].find((item) => item.id === id) ?? bookmarks[0];
      if (parts[3] === "status") {
        const failed = id === "bm-010";
        return fulfillJson(route, {
          data: {
            bookmarkId: id,
            bookmarkStatus: bookmark.status,
            last_failure: failed
              ? {
                  stage: "ai_enrich",
                  message: "Provider returned 401. Check the configured API key or switch to keyword-only mode.",
                  configuration_related: true,
                  retryable: true,
                  failed_at: isoDaysAgo(0, 6),
                  dismissed_at: null,
                }
              : null,
            job: bookmark.status === "saved" ? {
              id: `job-${id}`,
              type: "bookmark_pipeline",
              status: "pending",
              error: null,
              created_at: isoDaysAgo(0, 1),
              started_at: null,
              finished_at: null,
            } : null,
          },
        });
      }
      if (parts[3] === "related") return fulfillJson(route, { data: activeRows.filter((item) => item.id !== id).slice(0, 3) });
      if (parts[3] === "retry") {
        return fulfillJson(route, { data: { batch_id: "retry-ui-audit", mode: "selected", enqueued: 1, skipped: 0, status_url: `${daemonOrigin}/reprocess/retry-ui-audit` } });
      }
      if (parts[3] === "failure" && parts[4] === "dismiss") return route.fulfill({ status: 204 });
      if (parts[3] === "restore") return fulfillJson(route, { data: { ...bookmark, is_trashed: 0, trashed_at: null } });
      if (parts[3] === "permanent") return route.fulfill({ status: 204 });
      if (method === "GET") return fulfillJson(route, { data: { ...bookmark, content: null } });
      if (method === "PUT") return fulfillJson(route, { data: { ...bookmark, ...(request.postDataJSON() ?? {}) } });
      if (method === "DELETE") return route.fulfill({ status: 204 });
    }

    if (pathname === "/trash") return fulfillJson(route, { data: trashedBookmarks });
    if (pathname === "/search") {
      const q = url.searchParams.get("q") ?? "";
      const mode = url.searchParams.get("mode") ?? "keyword";
      const rows = activeRows.filter((bookmark) => matchesSearch(bookmark, q)).map((bookmark, index) => ({
        ...bookmark,
        snippet: bookmark.description,
        rank: 1 - index * 0.05,
      }));
      return fulfillJson(route, { ...listResponse(rows), meta: { mode } });
    }
    if (pathname === "/timeline") {
      return fulfillJson(route, { data: timelineEvents, pagination: { total: timelineEvents.length, limit: 50, offset: 0, has_more: false } });
    }
    if (pathname === "/suggestions" && method === "GET") {
      const rows = options.suggestionsEmpty ? [] : suggestions;
      return fulfillJson(route, { data: rows, meta: { pending: rows.length, total: rows.length } });
    }
    if (pathname.startsWith("/suggestions/") && method === "POST") {
      return fulfillJson(route, { data: { ...suggestions[0], status: pathname.endsWith("/accept") ? "accepted" : "rejected", resolved_at: fixedNow.toISOString() } });
    }
    if (pathname === "/import" && method === "POST") {
      return fulfillJson(route, { data: { importId: "import-ui-audit", total: 42, warnings: 1, progressUrl: `${daemonOrigin}/import/import-ui-audit/progress` } });
    }
    if (pathname === "/import/import-ui-audit/progress") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: progress\ndata: ${JSON.stringify({ queued: 42, skipped: 1, total: 43, done: true, error: null })}\n\n`,
      });
    }
    if (pathname === "/export") {
      return route.fulfill({
        status: 200,
        headers: {
          "Content-Type": url.searchParams.get("format") === "csv" ? "text/csv" : "application/json",
          "Content-Disposition": `attachment; filename="little-imp-export.${url.searchParams.get("format") ?? "json"}"`,
        },
        body: url.searchParams.get("format") === "csv" ? "url,title\nhttps://example.com,Example\n" : JSON.stringify(activeRows),
      });
    }
    if (pathname === "/backup/list") return fulfillJson(route, { data: backupEntries });
    if (pathname === "/backup") return fulfillJson(route, { path: backupEntries[0].path, size_bytes: backupEntries[0].size_bytes, bookmark_count: 124, created_at: fixedNow.toISOString() });
    if (pathname === "/backup/verify") {
      return fulfillJson(route, {
        ok: true,
        name: backupEntries[0].name,
        path: backupEntries[0].path,
        checksum_verified: true,
        verified_files: ["snapshot.db", "manifest.json", "checksums.sha256"],
        bookmark_count: 124,
        created_at: fixedNow.toISOString(),
      });
    }
    if (pathname === "/backup/package") {
      return fulfillJson(route, { path: `${backupEntries[0].path}.littleimp-backup.enc`, source_path: backupEntries[0].path, encrypted: true, size_bytes: 4915200, created_at: fixedNow.toISOString() });
    }
    if (pathname === "/backup/package/verify") {
      return fulfillJson(route, { ok: true, path: `${backupEntries[0].path}.littleimp-backup.enc`, package_encrypted: true, checksum_verified: true, verified_files: ["snapshot.db", "manifest.json"], bookmark_count: 124, created_at: fixedNow.toISOString() });
    }
    if (pathname === "/backup/schedule" && method === "GET") {
      return fulfillJson(route, { data: { enabled: true, cron: "0 3 * * *", retention_count: 14, next_run_at: isoDaysAgo(-1) } });
    }
    if (pathname === "/backup/schedule" && method === "PUT") return fulfillJson(route, { data: request.postDataJSON() });
    if (pathname === "/backup/destination" && method === "GET") {
      return fulfillJson(route, { data: { path: settings.backup.local.destination_path, is_custom: true, writable: true } });
    }
    if (pathname === "/backup/destination" && method === "PUT") {
      const body = request.postDataJSON();
      return fulfillJson(route, { data: { path: body.path || "/Users/robert/Library/Application Support/Little Imp/backups", is_custom: Boolean(body.path), writable: true } });
    }
    if (pathname === "/restore") return fulfillJson(route, makeRestoreResult());
    if (pathname.startsWith("/reprocess/")) {
      return fulfillJson(route, { data: { batch_id: pathname.split("/").pop(), pending: 2, running: 1, done: 4, failed: 0 } });
    }

    return fulfillJson(route, { title: "Unhandled mock route", detail: `${method} ${pathname}` }, 500);
  });
}

async function newPage(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 1000 },
    deviceScaleFactor: options.deviceScaleFactor ?? 2,
    colorScheme: options.theme === "light" ? "light" : "dark",
  });
  await context.addInitScript((init) => {
    if (!init.skipStorageReset) localStorage.clear();
    if (!init.skipStorageReset && init.preferences) {
      localStorage.setItem("little-imp-preferences", JSON.stringify(init.preferences));
    }
    if (!init.skipStorageReset && init.locked) {
      localStorage.setItem("little-imp-lock-enabled", "true");
      localStorage.setItem("little-imp-lock-hash", "ui-audit-placeholder-hash");
    }
    if (init.restoreRecovery) {
      localStorage.setItem("littleimp.restoreRecovery", JSON.stringify(init.restoreRecovery));
    }
  }, {
    theme: options.theme ?? "dark",
    preferences: options.preferences ?? { showButtonLabels: true, viewMode: "grid" },
    locked: options.locked ?? false,
    restoreRecovery: options.restoreRecovery ?? null,
    skipStorageReset: options.skipStorageReset ?? false,
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`[browser:${message.type()}] ${message.text()}`);
  });
  await installMocks(page, options);
  return { context, page };
}

async function applyTheme(page, theme = "dark") {
  await page.evaluate((nextTheme) => {
    const root = document.documentElement;
    root.classList.toggle("dark", nextTheme !== "light");
    root.classList.toggle("light", nextTheme === "light");
  }, theme);
  await page.waitForFunction(
    (nextTheme) => document.documentElement.classList.contains("dark") === (nextTheme !== "light"),
    theme,
  );
}

async function capture(browser, spec) {
  const { context, page } = await newPage(browser, spec);
  try {
    await page.goto(`${appUrl}${spec.path}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(spec.initialDelayMs ?? 600);
    if (spec.theme === "light") await applyTheme(page, "light");
    if (spec.action) await spec.action(page);
    await page.waitForTimeout(spec.delayMs ?? 500);
    const screenshotPath = path.join(outputDir, `${spec.slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: spec.fullPage ?? true });
    return { slug: spec.slug, title: spec.title, path: spec.path, image: `ui-ux-audit-assets/${spec.slug}.png` };
  } finally {
    await context.close();
  }
}

const screens = [
  { slug: "library-grid-overview", title: "Library grid overview", path: "/" },
  {
    slug: "library-list-overview",
    title: "Library list overview",
    path: "/",
    action: async (page) => {
      await page.locator("header button").last().click();
      await page.getByText("Preferences").waitFor({ timeout: 3000 });
      await page.locator('[aria-label="List view"]').click();
      await page.keyboard.press("Escape");
      await page.locator("main div.flex.flex-col.gap-2").waitFor({ timeout: 3000 });
    },
  },
  {
    slug: "library-empty-onboarding",
    title: "Empty library onboarding",
    path: "/",
    emptyLibrary: true,
    aiProvider: "none",
  },
  {
    slug: "library-search-no-results",
    title: "Library search with no results",
    path: "/",
    action: async (page) => {
      await page.getByPlaceholder("Search bookmarks...").fill("quantum gardening");
      await page.waitForTimeout(800);
    },
  },
  {
    slug: "library-light-theme",
    title: "Library light theme",
    path: "/",
    theme: "light",
  },
  {
    slug: "bookmark-detail-standard",
    title: "Bookmark detail dialog",
    path: "/",
    action: async (page) => {
      await page.getByText("Designing Command Palettes for Fast Recall").click();
      await page.getByText("Related Bookmarks").waitFor({ timeout: 3000 });
    },
  },
  {
    slug: "bookmark-detail-failure-recovery",
    title: "Bookmark detail with pipeline recovery",
    path: "/",
    action: async (page) => {
      await page.getByText("Failure Recovery UX Patterns").click();
      await page.getByText("AI enrichment failed").waitFor({ timeout: 3000 });
    },
  },
  {
    slug: "add-bookmark-dialog",
    title: "Add bookmark dialog",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Add$/ }).click();
      await page.getByPlaceholder("https://example.com/article").waitFor();
    },
  },
  {
    slug: "add-bookmark-invalid-url",
    title: "Add bookmark validation",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Add$/ }).click();
      await page.getByPlaceholder("https://example.com/article").fill("not-a-url");
      await page.getByRole("button", { name: "Save Bookmark" }).click();
      await page.getByText("Please enter a valid URL").waitFor();
    },
  },
  {
    slug: "import-bookmarks-dropzone",
    title: "Import bookmarks dropzone",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Import$/ }).click();
      await page.getByText("Drop your bookmark file here").waitFor();
    },
  },
  {
    slug: "import-bookmarks-success",
    title: "Import bookmarks success",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Import$/ }).click();
      await page.locator('input[type="file"]').setInputFiles({
        name: "bookmarks.html",
        mimeType: "text/html",
        buffer: Buffer.from("<!doctype NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF=\"https://example.com\">Example</A>"),
      });
      await page.getByText(/bookmarks queued for processing/).waitFor({ timeout: 4000 });
    },
  },
  {
    slug: "ai-command-palette-search-state",
    title: "AI command palette search state",
    path: "/",
    action: async (page) => {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }));
      });
      await page.locator("[cmdk-input]").fill("design");
      await page.waitForTimeout(1000);
    },
  },
  {
    slug: "date-range-picker",
    title: "Date range picker",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /Date range/ }).click();
      await page.getByRole("grid").first().waitFor();
    },
  },
  {
    slug: "export-format-menu",
    title: "Export format menu",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Export$/ }).click();
      await page.getByRole("menuitem", { name: "Export as JSON" }).waitFor({ state: "visible" });
      await page.waitForTimeout(200);
    },
  },
  {
    slug: "bulk-selection-toolbar",
    title: "Bulk selection toolbar",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Select$/ }).click();
      await page.getByText("Select all").waitFor();
    },
  },
  {
    slug: "bulk-delete-confirmation",
    title: "Bulk delete confirmation",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^Select$/ }).click();
      await page.getByText("Designing Command Palettes for Fast Recall").click();
      await page.getByRole("button", { name: /Delete \(1\)/ }).click();
      await page.getByText("Delete 1 bookmark?").waitFor();
    },
  },
  {
    slug: "category-management-context-menu",
    title: "Category management context menu",
    path: "/",
    action: async (page) => {
      await page.getByRole("button", { name: /^UX Patterns/ }).click({ button: "right" });
      await page.getByText(/Move to/).waitFor();
    },
  },
  {
    slug: "preferences-dialog",
    title: "Preferences dialog",
    path: "/",
    action: async (page) => {
      await page.locator("header button").last().click();
      await page.getByText("Preferences").waitFor();
    },
  },
  {
    slug: "keyboard-shortcuts-dialog",
    title: "Keyboard shortcuts dialog",
    path: "/",
    action: async (page) => {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true }));
      });
      await page.getByText("Keyboard Shortcuts").waitFor();
    },
  },
  { slug: "domains-index", title: "All domains index", path: "/domains" },
  { slug: "timeline-activity-feed", title: "Library timeline", path: "/timeline" },
  {
    slug: "review-queue-active",
    title: "Review queue with suggestions",
    path: "/review-queue",
    bookmarkTotalOverride: 35,
  },
  {
    slug: "review-queue-cold-start",
    title: "Review queue cold start",
    path: "/review-queue",
    bookmarkTotalOverride: 5,
    suggestionsEmpty: true,
  },
  { slug: "archive-list", title: "Archive list", path: "/archive" },
  { slug: "trash-retention-list", title: "Trash retention list", path: "/trash" },
  { slug: "settings-long-form", title: "Settings long form", path: "/settings" },
  {
    slug: "restore-recovery-overlay",
    title: "Post-restore restart overlay",
    path: "/settings",
    skipStorageReset: true,
    restoreRecovery: makeRestoreResult(),
    fullPage: false,
    action: async (page) => {
      await page.evaluate((result) => {
        localStorage.clear();
        localStorage.setItem("littleimp.restoreRecovery", JSON.stringify(result));
      }, makeRestoreResult());
      await page.reload();
      await page.getByText("Restart Little Imp").waitFor({ timeout: 5000 });
    },
  },
  {
    slug: "daemon-offline-banner",
    title: "Daemon offline banner",
    path: "/",
    offline: true,
    initialDelayMs: 1200,
    action: async (page) => {
      await page.getByText(/Daemon offline/).waitFor({ timeout: 5000 });
    },
  },
  {
    slug: "lock-screen",
    title: "App lock screen",
    path: "/",
    locked: true,
  },
  {
    slug: "mobile-library-stack",
    title: "Mobile library stack",
    path: "/",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    fullPage: false,
  },
  {
    slug: "mobile-bookmark-detail-drawer",
    title: "Mobile bookmark detail drawer",
    path: "/",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    fullPage: false,
    action: async (page) => {
      await page.getByText("Designing Command Palettes for Fast Recall").click();
      await page.getByText("Related Bookmarks").waitFor({ timeout: 3000 });
    },
  },
  { slug: "not-found-route", title: "404 route", path: "/missing-screen" },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const captured = [];
try {
  for (const screen of screens) {
    console.log(`capturing ${screen.slug}`);
    captured.push(await capture(browser, screen));
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({ generatedAt: fixedNow.toISOString(), appUrl, screens: captured }, null, 2)}\n`,
  "utf8"
);

console.log(`wrote ${captured.length} screenshots to ${outputDir}`);
