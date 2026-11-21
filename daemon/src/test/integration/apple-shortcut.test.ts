import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { createAppleShortcutRoute } from "../../routes/apple-shortcut.js";
import { buildShortcutWorkflow, toXmlPlist } from "../../integrations/apple-shortcut.js";
import { makeTestDb } from "../helpers/db.js";

const ORIGIN = "http://127.0.0.1:3210";

describe("apple shortcut generator", () => {
  it("serializes a valid workflow that targets /capture with the bearer token", () => {
    const xml = toXmlPlist(
      buildShortcutWorkflow({ serverUrl: "https://grimoire.example.ts.net/", token: "limp_it_secret", category: "Safari inbox" })
    );

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<string>https://grimoire.example.ts.net/capture</string>");
    expect(xml).toContain("Bearer limp_it_secret");
    expect(xml).toContain("Safari inbox");
    expect(xml).toContain("<string>WFURLContentItem</string>");
    expect(xml).toContain("<string>ActionExtension</string>");
  });

  it("sends `source` as a typed dictionary and avoids undocumented If parameters", () => {
    const xml = toXmlPlist(buildShortcutWorkflow({ serverUrl: "http://127.0.0.1:3210", token: "t" }));

    // A text-typed `source` is sent as "" and the daemon rejects it with 422.
    expect(xml).toMatch(/<key>WFItemType<\/key>\s*<integer>1<\/integer>/);
    // An If whose value parameter does not import makes Shortcuts refuse to run ("choose a value for each parameter").
    expect(xml).not.toContain("is.workflow.actions.conditional");
    // Reading data.bookmark.id stops the shortcut on error responses, so "Saved" never shows on a failure.
    expect(xml).toContain("<string>data.bookmark.id</string>");
    expect(xml).toContain("Saved to Grimoire");
  });

  it("omits the category field when none is given and escapes markup", () => {
    const xml = toXmlPlist(buildShortcutWorkflow({ serverUrl: "http://127.0.0.1:3210", token: "a<b>&c" }));

    expect(xml).not.toContain("<string>category</string>");
    expect(xml).toContain("Bearer a&lt;b&gt;&amp;c");
  });
});

describe("POST /integrations/apple-shortcut", () => {
  let db: Database;
  let app: Hono;
  let embeddedToken: string | null;

  beforeEach(() => {
    db = makeTestDb();
    embeddedToken = null;
    // Mount the route alone with a stub generator so tests never invoke the macOS signing service.
    app = new Hono();
    app.route(
      "/",
      createAppleShortcutRoute({
        db,
        generate: async (options) => {
          embeddedToken = options.token;
          return { data: new TextEncoder().encode(`${options.serverUrl}|${options.category ?? ""}`), signed: false };
        },
      })
    );
  });

  afterEach(() => db.close());

  function post(body: unknown, contentType = "application/json") {
    return app.request("/integrations/apple-shortcut", {
      method: "POST",
      headers: { "Content-Type": contentType, Origin: ORIGIN },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  function tokenCount(): number {
    return db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM integration_tokens").get()!.n;
  }

  it("returns a downloadable shortcut and creates exactly one named token", async () => {
    const response = await post({ server_url: "https://grimoire.example.ts.net", category: " Safari inbox " });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="SendToGrimoire.shortcut"');
    expect(response.headers.get("X-Grimoire-Shortcut-Signed")).toBe("false");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("https://grimoire.example.ts.net|Safari inbox");
    expect(embeddedToken).toStartWith("limp_it_");
    expect(tokenCount()).toBe(1);
    const row = db.query<{ name: string }, []>("SELECT name FROM integration_tokens").get();
    expect(row?.name).toBe("Apple Shortcut");
  });

  it("embeds a token that authenticates POST /capture", async () => {
    await post({ server_url: ORIGIN });
    const real = createApp({ db, queue: new JobQueue(db), startTime: new Date(), version: "test", staticDir: false });

    const capture = await real.request("/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${embeddedToken}` },
      body: JSON.stringify({ url: "https://example.com/from-shortcut", source: { client: "apple-shortcut" } }),
    });

    expect(capture.status).toBe(201);
  });

  it.each([
    ["missing server_url", {}],
    ["non-string server_url", { server_url: 5 }],
    ["relative server_url", { server_url: "grimoire.local" }],
    ["non-http scheme", { server_url: "ftp://example.com" }],
    ["credentials", { server_url: "https://user:pass@example.com" }],
    ["path", { server_url: "https://example.com/grimoire" }],
    ["query", { server_url: "https://example.com/?a=1" }],
    ["oversized name", { server_url: ORIGIN, name: "x".repeat(121) }],
    ["non-string category", { server_url: ORIGIN, category: 1 }],
    ["oversized category", { server_url: ORIGIN, category: "x".repeat(101) }],
  ])("rejects %s without creating a token", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");
    expect(tokenCount()).toBe(0);
  });

  it("rejects malformed JSON and non-JSON bodies", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post("server_url=x", "text/plain")).status).toBe(415);
    expect((await post("[]")).status).toBe(422);
    expect(tokenCount()).toBe(0);
  });
});
