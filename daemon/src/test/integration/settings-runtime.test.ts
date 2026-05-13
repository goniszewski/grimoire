import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { BookmarkRepository } from "../../db/bookmark-repository.js";
import { EmbeddingRepository } from "../../db/embedding-repository.js";
import { makeTestDb } from "../helpers/db.js";

let createApp: typeof import("../../server.js").createApp;
let JobQueue: typeof import("../../queue.js").JobQueue;
let runPipeline: typeof import("../../pipeline/pipeline.js").runPipeline;
let settingsManager: typeof import("../../settings.js").settingsManager;
let Config: typeof import("../../config.js").Config;

type MutableConfig = {
  LLM_API_KEY: string;
  EMBEDDING_API_KEY: string;
};

function withUrl(res: Response, url: string): Response {
  return new Proxy(res, {
    get(target, prop) {
      if (prop === "url") return url;
      const val = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

function makeHtmlResponse(html: string, finalUrl: string): Response {
  const bytes = new TextEncoder().encode(html);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const res = new Response(stream, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  return withUrl(res, finalUrl);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestHeaders(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Headers {
  if (init?.headers) return new Headers(init.headers);
  if (input instanceof Request) return input.headers;
  return new Headers();
}

describe("settings-driven AI runtime configuration", () => {
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const originalLlmApiKey = process.env.LLM_API_KEY;
  const configHome = mkdtempSync(join(tmpdir(), "littleimp-settings-runtime-"));
  let db: Database;
  let originalFetch: typeof globalThis.fetch;
  let originalConfigLlmApiKey = "";
  let originalConfigEmbeddingApiKey = "";

  beforeAll(async () => {
    process.env.XDG_CONFIG_HOME = configHome;
    process.env.LLM_API_KEY = "env-fallback-key";
    ({ Config } = await import("../../config.js"));
    originalConfigLlmApiKey = Config.LLM_API_KEY;
    originalConfigEmbeddingApiKey = Config.EMBEDDING_API_KEY;
    (Config as MutableConfig).LLM_API_KEY = "env-fallback-key";
    (Config as MutableConfig).EMBEDDING_API_KEY = "env-fallback-key";
    ({ createApp } = await import("../../server.js"));
    ({ JobQueue } = await import("../../queue.js"));
    ({ runPipeline } = await import("../../pipeline/pipeline.js"));
    ({ settingsManager } = await import("../../settings.js"));
  });

  beforeEach(() => {
    rmSync(join(configHome, "littleimp"), { recursive: true, force: true });
    settingsManager.invalidate();
    db = makeTestDb();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    settingsManager.invalidate();
    db.close();
  });

  afterAll(() => {
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    if (originalLlmApiKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = originalLlmApiKey;
    }
    (Config as MutableConfig).LLM_API_KEY = originalConfigLlmApiKey;
    (Config as MutableConfig).EMBEDDING_API_KEY = originalConfigEmbeddingApiKey;
    rmSync(configHome, { recursive: true, force: true });
  });

  it("uses OpenAI settings saved through PUT /settings for pipeline enrichment and embeddings", async () => {
    const app = createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });

    const settingsRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          provider: "openai",
          openai: { api_key: "settings-openai-key", model: "gpt-settings" },
          embeddings: { provider: "openai", model: "embed-settings" },
        },
      }),
    });
    expect(settingsRes.status).toBe(200);

    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/settings-runtime";
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, status)
       VALUES (?, ?, ?, ?, 'saved')`,
      [bookmarkId, url, "example.com", "Settings Runtime"]
    );

    const outbound: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      const urlString = requestUrl(input);
      const headers = requestHeaders(input, init);
      outbound.push({ url: urlString, authorization: headers.get("authorization") });

      if (urlString === url) {
        return makeHtmlResponse(
          `<html><head><title>Settings Runtime</title></head>
           <body><article><p>Runtime settings should drive enrichment.</p></article></body></html>`,
          url
        );
      }

      if (urlString.endsWith("/chat/completions")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Summary from settings-driven LLM.",
                  tags: ["runtime-settings"],
                  category: "Article",
                  confidence: 0.95,
                }),
              },
            },
          ],
        });
      }

      if (urlString.endsWith("/embeddings")) {
        return jsonResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await runPipeline(db, { bookmarkId, url });

    const content = db
      .query<{ summary: string | null }, [string]>(
        "SELECT summary FROM bookmark_content WHERE bookmark_id = ?"
      )
      .get(bookmarkId);
    expect(content?.summary).toBe("Summary from settings-driven LLM.");

    const embedding = new EmbeddingRepository(db).getByBookmarkId(bookmarkId);
    expect(embedding?.model).toBe("embed-settings");
    expect(embedding?.vector[0]).toBeCloseTo(0.1, 5);
    expect(embedding?.vector[1]).toBeCloseTo(0.2, 5);
    expect(embedding?.vector[2]).toBeCloseTo(0.3, 5);

    expect(
      outbound.some(
        (req) =>
          req.url.endsWith("/chat/completions") &&
          req.authorization === "Bearer settings-openai-key"
      )
    ).toBe(true);
    expect(
      outbound.some(
        (req) =>
          req.url.endsWith("/embeddings") &&
          req.authorization === "Bearer settings-openai-key"
      )
    ).toBe(true);
  });

  it("uses embedding settings saved through PUT /settings for semantic search and related bookmarks", async () => {
    const app = createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });
    const bookmarkRepo = new BookmarkRepository(db);
    const embeddingRepo = new EmbeddingRepository(db);
    const source = bookmarkRepo.create("https://example.com/source", "Source");
    const related = bookmarkRepo.create("https://example.com/related", "Related");
    embeddingRepo.upsert(source.id, "embed-settings", [1, 0]);
    embeddingRepo.upsert(related.id, "embed-settings", [0.9, 0.1]);

    const settingsRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          provider: "none",
          openai: { api_key: "settings-embedding-key", model: "gpt-settings" },
          embeddings: { provider: "openai", model: "embed-settings" },
        },
      }),
    });
    expect(settingsRes.status).toBe(200);

    const outbound: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      const urlString = requestUrl(input);
      const headers = requestHeaders(input, init);
      outbound.push({ url: urlString, authorization: headers.get("authorization") });
      if (urlString.endsWith("/embeddings")) {
        return jsonResponse({ data: [{ embedding: [1, 0] }] });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const searchRes = await app.request("/search?q=source&mode=semantic");
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as { data: Array<{ id: string }> };
    expect(searchJson.data.map((item) => item.id)).toContain(source.id);

    const hybridRes = await app.request("/search?q=source&mode=hybrid");
    expect(hybridRes.status).toBe(200);
    const hybridJson = (await hybridRes.json()) as { data: Array<{ id: string }> };
    expect(hybridJson.data.map((item) => item.id)).toContain(source.id);

    const relatedRes = await app.request(`/bookmarks/${source.id}/related`);
    expect(relatedRes.status).toBe(200);
    const relatedJson = (await relatedRes.json()) as { data: Array<{ id: string }> };
    expect(relatedJson.data.map((item) => item.id)).toContain(related.id);

    expect(
      outbound.some(
        (req) =>
          req.url.endsWith("/embeddings") &&
          req.authorization === "Bearer settings-embedding-key"
      )
    ).toBe(true);
  });

  it("does not return related bookmarks when the source embedding uses a different model", async () => {
    const app = createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });
    const bookmarkRepo = new BookmarkRepository(db);
    const embeddingRepo = new EmbeddingRepository(db);
    const source = bookmarkRepo.create("https://example.com/old-source", "Old Source");
    const candidate = bookmarkRepo.create("https://example.com/current-candidate", "Current Candidate");
    embeddingRepo.upsert(source.id, "old-embedding-model", [1, 0]);
    embeddingRepo.upsert(candidate.id, "embed-settings", [1, 0]);

    const settingsRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          provider: "none",
          openai: { api_key: "settings-embedding-key", model: "gpt-settings" },
          embeddings: { provider: "openai", model: "embed-settings" },
        },
      }),
    });
    expect(settingsRes.status).toBe(200);

    const relatedRes = await app.request(`/bookmarks/${source.id}/related`);
    expect(relatedRes.status).toBe(200);
    const relatedJson = (await relatedRes.json()) as { data: Array<{ id: string }> };
    expect(relatedJson.data).toEqual([]);
  });

  it("does not persist environment fallback secrets during unrelated settings updates", async () => {
    const app = createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });

    const putRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai: { provider: "openai" }, app: { theme: "dark" } }),
    });
    expect(putRes.status).toBe(200);

    const stored = readFileSync(join(configHome, "littleimp", "config.json"), "utf-8");
    expect(stored).not.toContain("env-fallback-key");
    expect(settingsManager.read().ai.openai.api_key).toBe("");

    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      const urlString = requestUrl(input);
      const headers = requestHeaders(input, init);
      requests.push({ url: urlString, authorization: headers.get("authorization") });
      return jsonResponse({ choices: [{ message: { content: "pong" } }] });
    }) as typeof fetch;

    const testRes = await app.request("/settings/test-ai", { method: "POST" });
    expect(testRes.status).toBe(200);
    const testJson = (await testRes.json()) as { ok: boolean };
    expect(testJson.ok).toBe(true);
    expect(requests).toEqual([
      {
        url: "https://api.openai.com/v1/chat/completions",
        authorization: "Bearer env-fallback-key",
      },
    ]);
  });

  it("reports runtime capability without secrets and ignores redacted secret placeholders on save", async () => {
    const app = createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });

    const putRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          provider: "openai",
          openai: { api_key: "persisted-secret-key", model: "gpt-settings" },
          embeddings: { provider: "openai", model: "embed-settings" },
        },
      }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await app.request("/settings");
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as {
      data: {
        ai: { openai: { api_key: string } };
        runtime: {
          llm: { enabled: boolean; provider: string; model: string | null; base_url: string | null };
          embeddings: { enabled: boolean; provider: string; model: string | null; base_url: string | null };
        };
      };
    };

    expect(getJson.data.ai.openai.api_key).toBe("***");
    expect(getJson.data.runtime.llm).toEqual({
      enabled: true,
      provider: "openai",
      model: "gpt-settings",
      base_url: "https://api.openai.com/v1",
    });
    expect(getJson.data.runtime.embeddings).toEqual({
      enabled: true,
      provider: "openai",
      model: "embed-settings",
      base_url: "https://api.openai.com/v1",
    });
    expect(JSON.stringify(getJson.data.runtime)).not.toContain("persisted-secret-key");

    const roundTripRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getJson.data),
    });
    expect(roundTripRes.status).toBe(200);

    expect(settingsManager.read().ai.openai.api_key).toBe("persisted-secret-key");
  });

  it("normalizes Ollama settings to OpenAI-compatible local runtime endpoints", async () => {
    const app = createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });

    const putRes = await app.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          provider: "ollama",
          ollama: { base_url: "http://localhost:11434", model: "llama3" },
          embeddings: { provider: "ollama", model: "nomic-embed-text" },
        },
      }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await app.request("/settings");
    const getJson = (await getRes.json()) as {
      data: {
        runtime: {
          llm: { enabled: boolean; provider: string; model: string | null; base_url: string | null };
          embeddings: { enabled: boolean; provider: string; model: string | null; base_url: string | null };
        };
      };
    };
    expect(getJson.data.runtime.llm).toEqual({
      enabled: true,
      provider: "ollama",
      model: "llama3",
      base_url: "http://localhost:11434/v1",
    });
    expect(getJson.data.runtime.embeddings).toEqual({
      enabled: true,
      provider: "ollama",
      model: "nomic-embed-text",
      base_url: "http://localhost:11434/v1",
    });

    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      const urlString = requestUrl(input);
      const headers = requestHeaders(input, init);
      requests.push({ url: urlString, authorization: headers.get("authorization") });
      return jsonResponse({ choices: [{ message: { content: "pong" } }] });
    }) as typeof fetch;

    const testRes = await app.request("/settings/test-ai", { method: "POST" });
    expect(testRes.status).toBe(200);
    const testJson = (await testRes.json()) as { ok: boolean };
    expect(testJson.ok).toBe(true);
    expect(requests).toEqual([
      {
        url: "http://localhost:11434/v1/chat/completions",
        authorization: null,
      },
    ]);
  });
});
