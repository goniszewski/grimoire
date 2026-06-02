import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkHealth,
  checkHealthAfterRestore,
  createTag,
  deleteTag,
  importBookmarksFile,
  listLibraryAggregates,
  listBookmarks,
  previewImportBookmarksFile,
  recordBookmarkOpen,
  renameTag,
  resolveDaemonUrl,
  searchBookmarks,
  updateBookmark,
} from "./api";
import type { LibraryAggregatesParams, ListBookmarksParams } from "./api";

describe("daemon URL resolution", () => {
  it("defaults to the packaged daemon URL when no override is configured", () => {
    expect(resolveDaemonUrl()).toBe("http://127.0.0.1:3210");
  });

  it("accepts a loopback override and removes trailing slashes", () => {
    expect(resolveDaemonUrl("http://127.0.0.1:3220///")).toBe("http://127.0.0.1:3220");
    expect(resolveDaemonUrl("http://localhost:3220/")).toBe("http://localhost:3220");
  });

  it("rejects non-loopback daemon URL overrides", () => {
    expect(() => resolveDaemonUrl("https://example.com:3220")).toThrow(
      "VITE_DAEMON_URL must point to localhost, 127.0.0.1, or ::1"
    );
  });
});

describe("daemon health API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockHealthResponse(body: unknown, status = 200) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }

  it("reports unhealthy when /health returns a non-2xx response", async () => {
    mockHealthResponse({ error: "database closed" }, 500);

    await expect(checkHealth()).resolves.toBe(false);
  });

  it("reports unhealthy when /health returns an unexpected 2xx payload", async () => {
    mockHealthResponse({ status: "starting" });

    await expect(checkHealth()).resolves.toBe(false);
  });

  it("reports post-restore health only after the daemon process started after restore", async () => {
    const restoredAt = "2026-05-15T12:00:00.000Z";
    const now = Date.parse("2026-05-15T12:01:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    mockHealthResponse({
      status: "ok",
      version: "0.1.0-beta",
      uptime: 10_000,
      queueSize: 0,
    });

    await expect(checkHealthAfterRestore(restoredAt, "http://127.0.0.1:3210/health")).resolves.toBe(true);
  });

  it("keeps post-restore health blocked when the daemon predates the restore", async () => {
    const restoredAt = "2026-05-15T12:00:00.000Z";
    const now = Date.parse("2026-05-15T12:01:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    mockHealthResponse({
      status: "ok",
      version: "0.1.0-beta",
      uptime: 120_000,
      queueSize: 0,
    });

    await expect(checkHealthAfterRestore(restoredAt, "http://127.0.0.1:3210/health")).resolves.toBe(false);
  });
});

describe("bookmark open metrics API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a user-triggered bookmark open through the daemon endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "bm-1",
            opened_count: 3,
            last_opened_at: "2026-05-31T12:00:00Z",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const result = await recordBookmarkOpen("bm-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/bookmarks/bm-1/open",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.data.opened_count).toBe(3);
    expect(result.data.last_opened_at).toBe("2026-05-31T12:00:00Z");
  });
});

describe("bookmark mutation API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends supported bookmark patches through the daemon PUT endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "bm-1",
            title: "Renamed",
            tags: ["typescript"],
            notes: null,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    await updateBookmark("bm-1", {
      title: "Renamed",
      tags: ["typescript"],
      is_pinned: 1,
      notes: null,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/bookmarks/bm-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          title: "Renamed",
          tags: ["typescript"],
          is_pinned: 1,
          notes: null,
        }),
      })
    );
  });
});

describe("library filter API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes parity filters for bookmark list requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [], pagination: { total: 0, limit: 20, offset: 0, has_more: false } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await listBookmarks({
      read_state: "unread",
      is_pinned: true,
      opened_count_min: 1,
      opened_count_max: 5,
      last_opened_from: "2026-06-01",
      last_opened_to: "2026-06-02",
    });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.searchParams.get("read_state")).toBe("unread");
    expect(url.searchParams.get("is_pinned")).toBe("true");
    expect(url.searchParams.get("opened_count_min")).toBe("1");
    expect(url.searchParams.get("opened_count_max")).toBe("5");
    expect(url.searchParams.get("last_opened_from")).toBe("2026-06-01");
    expect(url.searchParams.get("last_opened_to")).toBe("2026-06-02");
  });

  it("serializes server sort params for bookmark list requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [], pagination: { total: 0, limit: 20, offset: 0, has_more: false } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await listBookmarks({
      sort: "opened_count",
      direction: "desc",
    });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.searchParams.get("sort")).toBe("opened_count");
    expect(url.searchParams.get("direction")).toBe("desc");
  });

  it("does not serialize sort direction without a sort key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [], pagination: { total: 0, limit: 20, offset: 0, has_more: false } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await listBookmarks({
      direction: "asc",
    });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.searchParams.get("sort")).toBeNull();
    expect(url.searchParams.get("direction")).toBeNull();
  });

  it("serializes parity filters for search requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
          meta: { mode: "keyword" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    await searchBookmarks({
      q: "react",
      read_state: "read",
      is_pinned: false,
      opened_count_min: 2,
      last_opened_from: "2026-06-01",
    });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("read_state")).toBe("read");
    expect(url.searchParams.get("is_pinned")).toBe("false");
    expect(url.searchParams.get("opened_count_min")).toBe("2");
    expect(url.searchParams.get("last_opened_from")).toBe("2026-06-01");
  });

  it("serializes library aggregate filters without pagination or sorting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            total: 0,
            categories: [],
            tags: [],
            domains: [],
            read: { read: 0, unread: 0 },
            pinned: { pinned: 0, unpinned: 0 },
            read_later: { yes: 0, no: 0 },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    await listLibraryAggregates({
      tag: "typescript",
      domain: "example.com",
      category_id: "cat-1",
      read_later: true,
      read_state: "unread",
      is_pinned: false,
      opened_count_min: 1,
      last_opened_to: "2026-06-02",
      limit: 10,
      offset: 20,
      sort: "created_at",
      direction: "asc",
      archived: true,
    } as LibraryAggregatesParams & Pick<
      ListBookmarksParams,
      "limit" | "offset" | "sort" | "direction" | "archived"
    >);

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.pathname).toBe("/bookmarks/aggregates");
    expect(url.searchParams.get("tag")).toBe("typescript");
    expect(url.searchParams.get("domain")).toBe("example.com");
    expect(url.searchParams.get("category_id")).toBe("cat-1");
    expect(url.searchParams.get("read_later")).toBe("true");
    expect(url.searchParams.get("read_state")).toBe("unread");
    expect(url.searchParams.get("is_pinned")).toBe("false");
    expect(url.searchParams.get("opened_count_min")).toBe("1");
    expect(url.searchParams.get("last_opened_to")).toBe("2026-06-02");
    expect(url.searchParams.get("limit")).toBeNull();
    expect(url.searchParams.get("offset")).toBeNull();
    expect(url.searchParams.get("sort")).toBeNull();
    expect(url.searchParams.get("direction")).toBeNull();
    expect(url.searchParams.get("archived")).toBeNull();
  });

  it("serializes server sort params for search requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
          meta: { mode: "keyword" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    await searchBookmarks({
      q: "react",
      sort: "last_opened_at",
      direction: "asc",
    });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.searchParams.get("sort")).toBe("last_opened_at");
    expect(url.searchParams.get("direction")).toBe("asc");
  });
});

describe("tag management API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates tags through the daemon endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "tag-1",
            name: "typescript",
            created_at: "2026-05-31T12:00:00Z",
          },
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const result = await createTag("typescript");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/tags",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "typescript" }),
      })
    );
    expect(result.data.name).toBe("typescript");
  });

  it("deletes tags through the daemon endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await deleteTag("tag-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/tags/tag-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("renames tags through the daemon endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "tag-1",
            name: "react-query",
            created_at: "2026-05-31T12:00:00Z",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const result = await renameTag("tag-1", "react-query");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/tags/tag-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ name: "react-query" }),
      })
    );
    expect(result.data.name).toBe("react-query");
  });
});

describe("import API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("previews imports through the non-mutating preview endpoint with duplicate policy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            duplicatePolicy: { active: "merge", archived: "restore_merge", trashed: "skip" },
            remapping: {
              folders: [],
              tags: [],
            },
            summary: {
              totalRows: 1,
              importableRows: 1,
              new: 0,
              activeDuplicates: 1,
              archivedDuplicates: 0,
              trashedDuplicates: 0,
              invalidUrls: 0,
              privateUrls: 0,
              created: 0,
              merged: 1,
              restored: 0,
              skipped: 0,
            },
            folders: [],
            tags: ["typescript"],
            warnings: [],
            rows: [],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    const file = new File(["<DL><p></DL>"], "bookmarks.html", { type: "text/html" });
    const duplicatePolicy = { active: "merge", archived: "restore_merge", trashed: "skip" } as const;
    const remapping = {
      folders: [{ sourcePath: ["Research"], action: "create" as const, targetPath: ["Imported"] }],
      tags: [{ sourceTag: "typescript", action: "renamed" as const, targetName: "ts" }],
    };

    const result = await previewImportBookmarksFile(file, duplicatePolicy, remapping);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/import/preview",
      expect.objectContaining({ method: "POST" })
    );
    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("duplicatePolicy")).toBe(JSON.stringify(duplicatePolicy));
    expect(body.get("remapping")).toBe(JSON.stringify(remapping));
    expect(result.data.summary.merged).toBe(1);
  });

  it("commits imports with the selected duplicate policy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            importId: "import-1",
            total: 1,
            folders: 0,
            warnings: 0,
            duplicatePolicy: { active: "skip", archived: "restore_merge", trashed: "restore_merge" },
            remapping: {
              folders: [],
              tags: [],
            },
            progressUrl: "/import/import-1/progress",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    const file = new File(["<DL><p></DL>"], "bookmarks.html", { type: "text/html" });
    const duplicatePolicy = { archived: "restore_merge", trashed: "restore_merge" } as const;
    const remapping = {
      tags: [{ sourceTag: "legacy", action: "skipped" as const }],
    };

    await importBookmarksFile(file, duplicatePolicy, remapping);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/import",
      expect.objectContaining({ method: "POST" })
    );
    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("duplicatePolicy")).toBe(JSON.stringify(duplicatePolicy));
    expect(body.get("remapping")).toBe(JSON.stringify(remapping));
  });
});
