import type { Page, Route } from "@playwright/test";
import { BASE, makeApiBookmark, makeHealthResponse, makeSettings } from "./api-fixtures";
import type {
  BackupDestinationDto,
  BackupResultDto,
  BackupScheduleDto,
  BackupVerificationResultDto,
  ImportProgressEventDto,
  RestoreResultDto,
  SettingsDto,
  UpdateCheckResultDto,
} from "../daemon/src/api/types";

const now = () => new Date().toISOString();

type BookmarkStatus = "saved" | "fetched" | "extracted" | "ai_enriched" | "indexed";

type MutableBookmark = {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  status: BookmarkStatus;
  category_id: string | null;
  favicon_url: string | null;
  screenshot_url: string | null;
  is_pinned: 0 | 1;
  is_archived: 0 | 1;
  is_trashed: 0 | 1;
  trashed_at: string | null;
  read_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
};

type BookmarkSeed = Readonly<{
  id: string;
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  status: BookmarkStatus;
  category_id: string | null;
  favicon_url: string | null;
  screenshot_url: string | null;
  is_pinned: 0 | 1;
  is_archived: 0 | 1;
  is_trashed: 0 | 1;
  trashed_at: string | null;
  read_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tags: readonly string[];
}>;

type MockBackupEntry = {
  name: string;
  path: string;
  size_bytes: number;
  bookmark_count: number;
  created_at: string;
  source: "local" | "remote";
};

export interface MockDaemonState {
  bookmarks: MutableBookmark[];
  backupEntries: MockBackupEntry[];
  settings: SettingsDto;
  backupSchedule: BackupScheduleDto;
  backupDestination: BackupDestinationDto;
  requests: {
    health: number;
    imports: number;
    exportFormats: string[];
    searchQueries: Array<{ q: string; mode: string }>;
    createdBackups: number;
    verifiedBackups: string[];
    restoredBackups: string[];
    updateChecks: number;
  };
}

interface InstallMockDaemonOptions {
  bookmarks?: BookmarkSeed[];
  backupEntries?: MockBackupEntry[];
  aiProvider?: SettingsDto["ai"]["provider"];
}

function cloneBookmark(bookmark: BookmarkSeed): MutableBookmark {
  return {
    id: bookmark.id,
    url: bookmark.url,
    domain: bookmark.domain,
    title: bookmark.title,
    description: bookmark.description,
    status: bookmark.status,
    category_id: bookmark.category_id,
    favicon_url: bookmark.favicon_url,
    screenshot_url: bookmark.screenshot_url,
    is_pinned: bookmark.is_pinned,
    is_archived: bookmark.is_archived,
    is_trashed: bookmark.is_trashed,
    trashed_at: bookmark.trashed_at,
    read_at: bookmark.read_at,
    notes: bookmark.notes,
    created_at: bookmark.created_at,
    updated_at: bookmark.updated_at,
    tags: [...bookmark.tags],
  };
}

function listResponse(bookmarks: MutableBookmark[]) {
  return {
    data: bookmarks,
    pagination: {
      total: bookmarks.length,
      limit: 200,
      offset: 0,
      has_more: false,
    },
  };
}

function activeBookmarks(bookmarks: MutableBookmark[]) {
  return bookmarks.filter((bookmark) => !bookmark.is_archived && !bookmark.is_trashed);
}

function tagsMatch(bookmark: MutableBookmark, q: string) {
  return bookmark.tags.some((tag) => tag.toLowerCase().includes(q));
}

function searchMatches(bookmark: MutableBookmark, q: string) {
  const searchable = [
    bookmark.url,
    bookmark.domain,
    bookmark.title ?? "",
    bookmark.description ?? "",
  ].join(" ").toLowerCase();

  return searchable.includes(q) || tagsMatch(bookmark, q);
}

function makeBackupEntry(name = "smoke-backup-0"): MockBackupEntry {
  return {
    name,
    path: `/tmp/little-imp-smoke/${name}`,
    size_bytes: 4096,
    bookmark_count: 1,
    created_at: now(),
    source: "local",
  };
}

function makeBackupResult(entry: MockBackupEntry): BackupResultDto {
  return {
    path: entry.path,
    size_bytes: entry.size_bytes,
    bookmark_count: entry.bookmark_count,
    created_at: entry.created_at,
  };
}

function makeBackupVerification(entry: MockBackupEntry): BackupVerificationResultDto {
  return {
    ok: true,
    name: entry.name,
    path: entry.path,
    checksum_verified: true,
    verified_files: ["snapshot.db", "manifest.json", "checksums.sha256"],
    bookmark_count: entry.bookmark_count,
    created_at: entry.created_at,
  };
}

function makeRestoreResult(bookmarkCount: number): RestoreResultDto {
  return {
    restored_at: now(),
    bookmark_count: bookmarkCount,
    checksum_verified: true,
    rollback_path: "/tmp/little-imp-smoke/rollback",
    restart_required: true,
  };
}

function makeUpdateResult(): UpdateCheckResultDto {
  return {
    current_version: "0.1.0-beta",
    update_available: false,
    source: "https://github.com/goniszewski/little-imp/releases",
    channel: "beta",
    latest: null,
  };
}

function parseBookmarkId(pathname: string) {
  return pathname.split("/")[2];
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, json });
}

async function handleBookmarkRoute(route: Route, state: MockDaemonState, url: URL) {
  const request = route.request();
  const method = request.method();
  const pathname = url.pathname;

  if (pathname === "/bookmarks" && method === "GET") {
    const archived = url.searchParams.get("archived") === "true";
    const rows = state.bookmarks.filter((bookmark) =>
      archived ? bookmark.is_archived === 1 : bookmark.is_archived === 0 && bookmark.is_trashed === 0
    );
    return fulfillJson(route, listResponse(rows));
  }

  if (pathname === "/bookmarks" && method === "POST") {
    const body = request.postDataJSON() as { url: string; title?: string };
    const bookmark = cloneBookmark(makeApiBookmark({
      id: `bm-smoke-${state.bookmarks.length + 1}`,
      url: body.url,
      domain: new URL(body.url).hostname,
      title: body.title || "Local-first Search Notes",
      description: "A saved developer resource that is visible immediately.",
      status: "saved",
      tags: ["search", "local-first"],
      created_at: now(),
      updated_at: now(),
    }));
    state.bookmarks.push(bookmark);
    return fulfillJson(route, { data: bookmark }, 201);
  }

  if (pathname.endsWith("/status") && method === "GET") {
    const bookmarkId = parseBookmarkId(pathname);
    const bookmark = state.bookmarks.find((item) => item.id === bookmarkId);
    return fulfillJson(route, {
      data: {
        bookmarkId,
        bookmarkStatus: bookmark?.status ?? "saved",
        job: null,
      },
    });
  }

  if (pathname.endsWith("/related") && method === "GET") {
    return fulfillJson(route, { data: [] });
  }

  const bookmarkId = parseBookmarkId(pathname);
  const bookmark = state.bookmarks.find((item) => item.id === bookmarkId);

  if (bookmark && method === "GET") {
    return fulfillJson(route, { data: { ...bookmark, content: null } });
  }

  if (bookmark && method === "PUT") {
    const patch = request.postDataJSON() as Partial<MutableBookmark>;
    Object.assign(bookmark, patch, { updated_at: now() });
    return fulfillJson(route, { data: bookmark });
  }

  if (bookmark && method === "DELETE") {
    bookmark.is_trashed = 1;
    bookmark.trashed_at = now();
    bookmark.updated_at = now();
    return route.fulfill({ status: 204 });
  }

  return fulfillJson(route, { title: "Not Found" }, 404);
}

async function handleSearch(route: Route, state: MockDaemonState, url: URL) {
  const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
  const mode = url.searchParams.get("mode") ?? "keyword";
  state.requests.searchQueries.push({ q, mode });

  const rows = activeBookmarks(state.bookmarks)
    .filter((bookmark) => !q || searchMatches(bookmark, q))
    .map((bookmark, index) => ({
      ...bookmark,
      snippet: bookmark.description,
      rank: 1 - index * 0.1,
    }));

  return fulfillJson(route, {
    ...listResponse(rows),
    meta: { mode },
  });
}

async function handleImportProgress(route: Route) {
  const event: ImportProgressEventDto = {
    queued: 1,
    skipped: 0,
    total: 1,
    done: true,
    error: null,
  };

  await route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: `event: progress\ndata: ${JSON.stringify(event)}\n\n`,
  });
}

async function handleExport(route: Route, state: MockDaemonState, url: URL) {
  const format = url.searchParams.get("format") ?? "json";
  state.requests.exportFormats.push(format);

  const headers = {
    "Content-Disposition": `attachment; filename="bookmarks.${format}"`,
  };

  if (format === "csv") {
    return route.fulfill({
      status: 200,
      headers: { ...headers, "Content-Type": "text/csv" },
      body: "url,title\nhttps://example.com,Example\n",
    });
  }

  return route.fulfill({
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(activeBookmarks(state.bookmarks)),
  });
}

async function handleBackup(route: Route, state: MockDaemonState, url: URL) {
  const method = route.request().method();
  const pathname = url.pathname;

  if (pathname === "/backup/list" && method === "GET") {
    return fulfillJson(route, { data: state.backupEntries });
  }

  if (pathname === "/backup" && method === "POST") {
    state.requests.createdBackups += 1;
    const entry = makeBackupEntry(`smoke-backup-${state.requests.createdBackups}`);
    state.backupEntries.unshift(entry);
    return fulfillJson(route, makeBackupResult(entry));
  }

  if (pathname === "/backup/verify" && method === "POST") {
    const body = route.request().postDataJSON() as { name: string };
    state.requests.verifiedBackups.push(body.name);
    const entry = state.backupEntries.find((item) => item.name === body.name) ?? makeBackupEntry(body.name);
    return fulfillJson(route, makeBackupVerification(entry));
  }

  if (pathname === "/backup/schedule" && method === "GET") {
    return fulfillJson(route, { data: state.backupSchedule });
  }

  if (pathname === "/backup/schedule" && method === "PUT") {
    const patch = route.request().postDataJSON() as Partial<BackupScheduleDto>;
    state.backupSchedule = { ...state.backupSchedule, ...patch };
    return fulfillJson(route, { data: state.backupSchedule });
  }

  if (pathname === "/backup/destination" && method === "GET") {
    return fulfillJson(route, { data: state.backupDestination });
  }

  if (pathname === "/backup/destination" && method === "PUT") {
    const body = route.request().postDataJSON() as { path: string };
    state.backupDestination = {
      path: body.path || "/tmp/little-imp-smoke/backups",
      is_custom: Boolean(body.path),
      writable: true,
    };
    return fulfillJson(route, { data: state.backupDestination });
  }

  return fulfillJson(route, { title: "Not Found" }, 404);
}

export async function installMockDaemon(
  page: Page,
  options: InstallMockDaemonOptions = {}
): Promise<MockDaemonState> {
  const state: MockDaemonState = {
    bookmarks: (options.bookmarks ?? []).map(cloneBookmark),
    backupEntries: [...(options.backupEntries ?? [makeBackupEntry()])],
    settings: makeSettings(options.aiProvider ?? "none"),
    backupSchedule: {
      enabled: false,
      cron: "0 3 * * *",
      retention_count: 7,
      next_run_at: null,
    },
    backupDestination: {
      path: "/tmp/little-imp-smoke/backups",
      is_custom: false,
      writable: true,
    },
    requests: {
      health: 0,
      imports: 0,
      exportFormats: [],
      searchQueries: [],
      createdBackups: 0,
      verifiedBackups: [],
      restoredBackups: [],
      updateChecks: 0,
    },
  };

  await page.route(`${BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === "/health") {
      state.requests.health += 1;
      return fulfillJson(route, makeHealthResponse());
    }

    if (pathname === "/categories") return fulfillJson(route, { data: [] });
    if (pathname === "/domains") return fulfillJson(route, { data: [] });
    if (pathname === "/tags") return fulfillJson(route, { data: [] });
    if (pathname === "/suggestions") return fulfillJson(route, { data: [], meta: { pending: 0, total: 0 } });

    if (pathname === "/settings" && method === "GET") return fulfillJson(route, { data: state.settings });
    if (pathname === "/settings" && method === "PUT") {
      state.settings = { ...state.settings, ...(request.postDataJSON() as Partial<SettingsDto>) };
      return fulfillJson(route, { data: state.settings });
    }
    if (pathname === "/settings/test-ai") return fulfillJson(route, { ok: true, message: "Connected" });
    if (pathname === "/settings/test-s3") return fulfillJson(route, { ok: true, message: "Connected" });

    if (pathname.startsWith("/bookmarks")) return handleBookmarkRoute(route, state, url);
    if (pathname === "/trash") {
      return fulfillJson(route, { data: state.bookmarks.filter((bookmark) => bookmark.is_trashed === 1) });
    }
    if (pathname === "/search") return handleSearch(route, state, url);

    if (pathname === "/import" && method === "POST") {
      state.requests.imports += 1;
      return fulfillJson(route, {
        data: {
          importId: "import-smoke-1",
          total: 1,
          warnings: 0,
          progressUrl: `${BASE}/import/import-smoke-1/progress`,
        },
      });
    }
    if (pathname === "/import/import-smoke-1/progress") return handleImportProgress(route);
    if (pathname === "/export") return handleExport(route, state, url);

    if (pathname.startsWith("/backup")) return handleBackup(route, state, url);
    if (pathname === "/restore" && method === "POST") {
      const body = request.postDataJSON() as { name?: string; key?: string };
      state.requests.restoredBackups.push(body.name ?? body.key ?? "unknown");
      return fulfillJson(route, makeRestoreResult(state.bookmarks.length));
    }

    if (pathname === "/updates/check") {
      state.requests.updateChecks += 1;
      return fulfillJson(route, { data: makeUpdateResult() });
    }

    return fulfillJson(route, { title: "Unhandled mock daemon route", detail: `${method} ${pathname}` }, 500);
  });

  return state;
}
