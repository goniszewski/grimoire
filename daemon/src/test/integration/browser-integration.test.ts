import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("browser extension integration", () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = makeTestDb();
    app = createApp({
      db,
      queue: new JobQueue(db),
      startTime: new Date(),
      version: "1.2.3-test",
      staticDir: false,
    });
  });

  afterEach(() => db.close());

  async function token(): Promise<string> {
    const response = await app.request("/integration-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3210" },
      body: JSON.stringify({ name: "Grimoire Companion" }),
    });
    const body = (await response.json()) as { data: { token: string } };
    return body.data.token;
  }

  it("advertises the versioned capture contract only to an authenticated client", async () => {
    const unauthorized = await app.request("/integrations/browser/v1/capabilities");
    expect(unauthorized.status).toBe(401);

    const response = await app.request("/integrations/browser/v1/capabilities", {
      headers: {
        Authorization: `Bearer ${await token()}`,
        Origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    );
    expect(await response.json()).toMatchObject({
      data: {
        protocol: "grimoire-browser-capture",
        protocol_version: 1,
        grimoire_version: "1.2.3-test",
        endpoints: {
          capture: "/capture",
          taxonomy: "/integrations/browser/v1/taxonomy",
        },
        capture_fields: {
          is_pinned: true,
          read_later: true,
        },
      },
    });
  });

  it("accepts authenticated capture from Chrome, Firefox, and Safari extension origins", async () => {
    const bearer = await token();
    for (const origin of [
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
      "moz-extension://8f2d3a0b-31dc-47f4-b783-36f8c9746ee8",
      "safari-web-extension://com.goniszewski.Grimoire-Companion",
    ]) {
      const response = await app.request("/capture", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({ url: `https://example.com/${encodeURIComponent(origin)}` }),
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });

  it("does not extend extension-origin access to other browser writes", async () => {
    const bearer = await token();
    for (const origin of [
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
      "safari-web-extension://com.goniszewski.Grimoire-Companion",
    ]) {
      const response = await app.request("/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({ name: "blocked" }),
      });
      expect(response.status).toBe(403);
    }
  });

  it("keeps extension-origin taxonomy reads authenticated and blocks unrelated reads", async () => {
    const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
    const blocked = await app.request("/bookmarks", { headers: { Origin: origin } });
    expect(blocked.status).toBe(403);
    const unknownIntegrationRead = await app.request("/integrations/browser/v1/future", {
      headers: { Origin: origin },
    });
    expect(unknownIntegrationRead.status).toBe(403);

    const unauthorized = await app.request("/integrations/browser/v1/taxonomy", {
      headers: { Origin: origin },
    });
    expect(unauthorized.status).toBe(401);

    const response = await app.request("/integrations/browser/v1/taxonomy", {
      headers: { Origin: origin, Authorization: `Bearer ${await token()}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(await response.json()).toEqual({ data: { categories: [], tags: [] } });
  });

  it("allows capture preflight without treating extension origins as first-party", async () => {
    for (const origin of [
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
      "safari-web-extension://com.goniszewski.Grimoire-Companion",
    ]) {
      const response = await app.request("/capture", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });
});
