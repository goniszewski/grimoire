import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHealth, checkHealthAfterRestore, recordBookmarkOpen, resolveDaemonUrl } from "./api";

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
