import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";
import { Config } from "../../config.js";

type MutableConfig = {
  CORS_ORIGINS: string[];
};

describe("Security hardening", () => {
  let db: Database;
  let queue: JobQueue;

  beforeEach(() => {
    db = makeTestDb();
    queue = new JobQueue(db);
  });

  afterEach(() => {
    db.close();
  });

  it("adds browser security headers to static frontend responses", async () => {
    const staticDir = await mkdtemp(join(tmpdir(), "little-imp-security-static-"));
    await mkdir(join(staticDir, "assets"), { recursive: true });
    await writeFile(
      join(staticDir, "index.html"),
      '<!doctype html><html><head><title>Little Imp</title></head><body><div id="root"></div></body></html>'
    );
    await writeFile(join(staticDir, "assets", "app.js"), "console.log('little imp');");

    try {
      const app = createApp({
        db,
        queue,
        startTime: new Date(),
        version: "0.0.0-test",
        staticDir,
      });

      const res = await app.request("/", {
        headers: { Accept: "text/html" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
      expect(res.headers.get("permissions-policy")).toContain("camera=()");
      expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(res.headers.get("content-security-policy")).toContain("object-src 'none'");
      expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(res.headers.get("content-security-policy")).toContain("img-src 'self' data: blob: https:");
      expect(res.headers.get("content-security-policy")).toContain("https://fonts.gstatic.com");
      expect(res.headers.get("content-security-policy")).not.toContain("[::1]");
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("rejects unsafe browser requests from non-local origins", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ url: "https://example.com/from-evil-origin" }),
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Origin is not allowed");
  });

  it("allows same-daemon local browser writes", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3210",
      },
      body: JSON.stringify({ url: "https://example.com/from-local-origin" }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3210");
  });

  it("allows non-browser local client writes without an Origin header", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/local-client-without-origin" }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns predictable CORS preflight responses for allowed and unsafe origins", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const allowed = await app.request("/bookmarks", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(allowed.headers.get("access-control-allow-methods")).toContain("POST");
    expect(allowed.headers.get("access-control-allow-headers")).toContain("Authorization");

    const rejected = await app.request("/bookmarks", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
    const json = (await rejected.json()) as { error: string };
    expect(json.error).toContain("Origin is not allowed");
  });

  it("ignores configured non-loopback CORS origins while allowing configured loopback origins", async () => {
    const originalOrigins = Config.CORS_ORIGINS;
    (Config as MutableConfig).CORS_ORIGINS = ["https://evil.example", "http://localhost:4567"];

    try {
      const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

      const rejected = await app.request("/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
        },
        body: JSON.stringify({ url: "https://example.com/configured-non-loopback-origin" }),
      });
      expect(rejected.status).toBe(403);

      const allowed = await app.request("/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:4567",
        },
        body: JSON.stringify({ url: "https://example.com/configured-loopback-origin" }),
      });
      expect(allowed.status).toBe(201);
      expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:4567");
    } finally {
      (Config as MutableConfig).CORS_ORIGINS = originalOrigins;
    }
  });

  it("rejects oversized declared bodies on expensive endpoints before parsing", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const importRes = await app.request("/import", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=littleimp",
        "Content-Length": String(10 * 1024 * 1024 + 1),
      },
      body: "--littleimp--",
    });
    expect(importRes.status).toBe(413);

    const backupVerifyRes = await app.request("/backup/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(64 * 1024 + 1),
      },
      body: "{}",
    });
    expect(backupVerifyRes.status).toBe(413);

    const integrationTokenRes = await app.request("/integration-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(64 * 1024 + 1),
      },
      body: "{}",
    });
    expect(integrationTokenRes.status).toBe(413);

    const captureRes = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(256 * 1024 + 1),
      },
      body: "{}",
    });
    expect(captureRes.status).toBe(413);
  });

  it("rejects invalid declared body lengths on guarded endpoints", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const res = await app.request("/backup/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "999999999999999999999999999999",
      },
      body: "{}",
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Invalid Content-Length");
  });

  it("returns 400 for restore request bodies that are not JSON objects", async () => {
    const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });

    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Request body must be an object");
  });
});
