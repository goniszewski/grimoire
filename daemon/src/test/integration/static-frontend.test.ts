import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("Static frontend serving", () => {
  let staticDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    staticDir = await mkdtemp(join(tmpdir(), "little-imp-static-"));
    await mkdir(join(staticDir, "assets"));
    await writeFile(
      join(staticDir, "index.html"),
      '<!doctype html><html><head><title>Little Imp</title></head><body><div id="root"></div></body></html>'
    );
    await writeFile(
      join(staticDir, "assets", "app.js"),
      'document.querySelector("#root")?.setAttribute("data-ready", "true");'
    );

    const db = makeTestDb();
    const deps = {
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
      staticDir,
    };
    app = createApp(deps);
  });

  afterEach(async () => {
    await rm(staticDir, { recursive: true, force: true });
  });

  it("serves the built frontend at the root path", async () => {
    const res = await app.request("/", {
      headers: { Accept: "text/html" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    await expect(res.text()).resolves.toContain('<div id="root"></div>');
  });

  it("serves static assets from the built frontend", async () => {
    const res = await app.request("/assets/app.js");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    await expect(res.text()).resolves.toContain("data-ready");
  });

  it("falls back to index.html for browser-routed frontend paths", async () => {
    const res = await app.request("/settings/backups", {
      headers: { Accept: "text/html" },
    });

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain("<title>Little Imp</title>");
  });
});
