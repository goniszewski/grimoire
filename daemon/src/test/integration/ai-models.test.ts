import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

let createApp: typeof import("../../server.js").createApp;
let settingsManager: typeof import("../../settings.js").settingsManager;

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function openRouterCatalogBody(): Record<string, unknown> {
  return {
    data: [
      {
        id: "openai/gpt-5.2",
        name: "OpenAI: GPT-5.2",
        context_length: 400000,
        pricing: { prompt: "0.000001", completion: "0.000004" },
      },
      {
        id: "inclusionai/ling-3.0-flash:free",
        name: "Ling-3.0-flash (free)",
        context_length: 262144,
        pricing: { prompt: "0", completion: "0" },
      },
      {
        id: "poolside/laguna-s-2.1:free",
        name: "Poolside: Laguna S 2.1 (free)",
        context_length: null,
        pricing: { prompt: "0", completion: "0" },
      },
      {
        id: "",
        name: "Invalid entry without an id",
        context_length: 100,
        pricing: { prompt: "0", completion: "0" },
      },
    ],
  };
}

describe("GET /settings/ai-models", () => {
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const configHome = mkdtempSync(join(tmpdir(), "littleimp-ai-models-"));
  let db: Database;
  let originalFetch: typeof globalThis.fetch;

  beforeAll(async () => {
    process.env.XDG_CONFIG_HOME = configHome;
    ({ createApp } = await import("../../server.js"));
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
  });

  function makeApp() {
    return createApp({
      db,
      queue: new JobQueue(),
      startTime: new Date(),
      version: "0.0.0-test",
    });
  }

  /** The daemon requires the app's custom header on catalog requests. */
  function catalogRequest(path: string): Response | Promise<Response> {
    return makeApp().request(path, { headers: { "X-LittleImp-Frontend": "1" } });
  }

  it("filters the catalog to zero-priced models when free=true", async () => {
    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      requests.push({
        url: requestUrl(input),
        authorization: init?.headers ? new Headers(init.headers).get("authorization") : null,
      });
      return new Response(JSON.stringify(openRouterCatalogBody()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        provider: string;
        free: boolean;
        fetched_at: string;
        models: Array<{ id: string; name: string; context_length: number | null; prompt_price: string | null; completion_price: string | null }>;
      };
    };
    // The catalog is fetched without the misleading supported_parameters=free
    // param (that means "has a free variant") and filtered on pricing instead.
    expect(requests).toEqual([
      { url: "https://openrouter.ai/api/v1/models", authorization: null },
    ]);
    expect(body.data.provider).toBe("openrouter");
    expect(body.data.free).toBe(true);
    expect(typeof body.data.fetched_at).toBe("string");
    expect(body.data.models).toEqual([
      {
        id: "inclusionai/ling-3.0-flash:free",
        name: "Ling-3.0-flash (free)",
        context_length: 262144,
        prompt_price: "0",
        completion_price: "0",
      },
      {
        id: "poolside/laguna-s-2.1:free",
        name: "Poolside: Laguna S 2.1 (free)",
        context_length: null,
        prompt_price: "0",
        completion_price: "0",
      },
    ]);
  });

  it("keeps paid models when free=false", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(requestUrl(input));
      return new Response(JSON.stringify(openRouterCatalogBody()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=false");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { free: boolean; models: Array<{ id: string }> } };
    expect(urls).toEqual(["https://openrouter.ai/api/v1/models"]);
    expect(body.data.free).toBe(false);
    expect(body.data.models.map((m) => m.id)).toEqual([
      "openai/gpt-5.2",
      "inclusionai/ling-3.0-flash:free",
      "poolside/laguna-s-2.1:free",
    ]);
  });

  it("uses the configured OpenRouter base URL", async () => {
    await makeApp().request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          openrouter: { base_url: "https://or.example.test/v1/" },
        },
      }),
    });

    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(requestUrl(input));
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(200);
    expect(urls).toEqual(["https://or.example.test/v1/models"]);
  });

  it("drops query and hash from the configured base URL", async () => {
    await makeApp().request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          openrouter: { base_url: "https://or.example.test/v1?token=secret#frag" },
        },
      }),
    });

    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(requestUrl(input));
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(200);
    expect(urls).toEqual(["https://or.example.test/v1/models"]);
  });

  it("rejects unsupported providers with 400", async () => {
    const res = await catalogRequest("/settings/ai-models?provider=ollama&free=true");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Unsupported Provider");
  });

  it("returns 502 when the upstream catalog fails, without leaking the upstream body", async () => {
    globalThis.fetch = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.title).toBe("Upstream Model Catalog Error");
    expect(body.detail).toContain("HTTP 500");
    expect(body.detail).not.toContain("boom");
  });

  it("returns 502 when the upstream body is not valid JSON", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Upstream Model Catalog Error");
  });

  it("returns 502 when the upstream body is missing the data array", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.title).toBe("Upstream Model Catalog Error");
    expect(body.detail).toContain("data array");
  });

  it("returns 422 when the configured base URL is invalid", async () => {
    settingsManager.write({
      ai: {
        openrouter: { base_url: "not-a-url", model: "openai/gpt-latest" },
      },
    } as Parameters<typeof settingsManager.write>[0]);

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(422);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.title).toBe("Invalid Base URL");
    expect(body.detail).toContain("not-a-url");
  });

  it("returns 502 on network errors", async () => {
    globalThis.fetch = (async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.title).toBe("Upstream Model Catalog Error");
    expect(body.detail).toContain("connection refused");
  });

  it("rejects requests without the X-LittleImp-Frontend header with 403", async () => {
    const res = await makeApp().request("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Forbidden");
  });

  it("rejects a redirect to a private host before following it", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input, init) => {
      urls.push(requestUrl(input));
      expect(init?.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1:9999/v1/models" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    expect(urls).toEqual(["https://openrouter.ai/api/v1/models"]);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.detail).toContain("Redirect to private or invalid host blocked");
  });

  it("rejects an IPv4-mapped IPv6 private redirect before following it", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input, init) => {
      urls.push(requestUrl(input));
      expect(init?.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { location: "http://[::ffff:127.0.0.1]:9999/v1/models" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    expect(urls).toEqual(["https://openrouter.ai/api/v1/models"]);
    const body = (await res.json()) as { detail?: string };
    expect(body.detail).toContain("Redirect to private or invalid host blocked");
  });

  it("returns 502 when the upstream body exceeds the size cap", async () => {
    globalThis.fetch = (async () =>
      new Response("x".repeat(10 * 1024 * 1024 + 1), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.detail).toContain("too large");
  });

  it("rejects a free param outside the documented enum with 400", async () => {
    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=1");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Invalid Query");
  });

  it("refuses to fetch the catalog from a private host base URL", async () => {
    settingsManager.write({
      ai: {
        openrouter: { base_url: "http://127.0.0.1:9999/v1", model: "openai/gpt-latest" },
      },
    } as Parameters<typeof settingsManager.write>[0]);

    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(requestUrl(input));
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(502);
    expect(urls).toEqual([]);
    const body = (await res.json()) as { title: string; detail?: string };
    expect(body.title).toBe("Upstream Model Catalog Error");
    expect(body.detail).toContain("private host");
  });

  it("treats a base_url pointing at the models endpoint as-is", async () => {
    settingsManager.write({
      ai: {
        openrouter: { base_url: "https://or.example.test/v1/models", model: "openai/gpt-latest" },
      },
    } as Parameters<typeof settingsManager.write>[0]);

    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(requestUrl(input));
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter&free=true");
    expect(res.status).toBe(200);
    expect(urls).toEqual(["https://or.example.test/v1/models"]);
  });

  describe("provider=litellm", () => {
    function liteLLMModelInfoBody(): Record<string, unknown> {
      return {
        data: [
          {
            model_name: "claude-sonnet",
            model_info: { mode: "chat", max_input_tokens: 200000, input_cost_per_token: 3e-6, output_cost_per_token: 1.5e-5 },
          },
          // A second deployment of the same model name (load balancing) is listed once.
          { model_name: "claude-sonnet", model_info: { mode: "chat", max_input_tokens: 200000 } },
          { model_name: "gemini-flash", model_info: { mode: "chat", max_tokens: 65536 } },
          { model_name: "legacy-instruct", model_info: {} },
          { model_name: "text-embedding", model_info: { mode: "embedding" } },
          { model_name: "whisper", model_info: { mode: "audio_transcription" } },
          { model_info: { mode: "chat" } },
        ],
      };
    }

    function writeLiteLLM(litellm: { api_key?: string; base_url: string; model?: string }) {
      settingsManager.write({
        ai: { litellm: { api_key: "", model: "claude-sonnet", ...litellm } },
      } as Parameters<typeof settingsManager.write>[0]);
    }

    it("lists the proxy's chat models from /model/info with the virtual key", async () => {
      writeLiteLLM({ api_key: "sk-litellm-virtual", base_url: "http://localhost:4000/" });
      const requests: Array<{ url: string; authorization: string | null; redirect?: RequestRedirect }> = [];
      globalThis.fetch = (async (input, init) => {
        requests.push({
          url: requestUrl(input),
          authorization: init?.headers ? new Headers(init.headers).get("authorization") : null,
          redirect: init?.redirect,
        });
        return new Response(JSON.stringify(liteLLMModelInfoBody()), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;

      const res = await catalogRequest("/settings/ai-models?provider=litellm");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          provider: string;
          models: Array<{ id: string; name: string; context_length: number | null; prompt_price: string | null; completion_price: string | null }>;
        };
      };
      // The loopback proxy is the same host chat requests already use; redirects are not followed.
      expect(requests).toEqual([
        { url: "http://localhost:4000/model/info", authorization: "Bearer sk-litellm-virtual", redirect: "manual" },
      ]);
      expect(body.data.provider).toBe("litellm");
      expect(body.data.models).toEqual([
        { id: "claude-sonnet", name: "claude-sonnet", context_length: 200000, prompt_price: "0.000003", completion_price: "0.000015" },
        { id: "gemini-flash", name: "gemini-flash", context_length: 65536, prompt_price: null, completion_price: null },
        { id: "legacy-instruct", name: "legacy-instruct", context_length: null, prompt_price: null, completion_price: null },
      ]);
    });

    it("sends no Authorization header when no virtual key is saved", async () => {
      writeLiteLLM({ base_url: "https://litellm.example.test/v1" });
      const requests: Array<{ url: string; authorization: string | null }> = [];
      globalThis.fetch = (async (input, init) => {
        requests.push({
          url: requestUrl(input),
          authorization: init?.headers ? new Headers(init.headers).get("authorization") : null,
        });
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }) as typeof fetch;

      const res = await catalogRequest("/settings/ai-models?provider=litellm");
      expect(res.status).toBe(200);
      // A base URL saved with /v1 still reaches the proxy root's /model/info.
      expect(requests).toEqual([{ url: "https://litellm.example.test/model/info", authorization: null }]);
    });

    it("falls back to /v1/models when /model/info is not available", async () => {
      writeLiteLLM({ api_key: "sk-key", base_url: "http://localhost:4000" });
      const urls: string[] = [];
      globalThis.fetch = (async (input) => {
        const url = requestUrl(input);
        urls.push(url);
        if (url.endsWith("/model/info")) return new Response("not found", { status: 404 });
        return new Response(JSON.stringify({ data: [{ id: "gpt-4o-mini" }, { id: "" }, { id: "claude-sonnet" }] }), {
          status: 200,
        });
      }) as typeof fetch;

      const res = await catalogRequest("/settings/ai-models?provider=litellm");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { models: Array<{ id: string; context_length: number | null }> } };
      expect(urls).toEqual(["http://localhost:4000/model/info", "http://localhost:4000/v1/models"]);
      expect(body.data.models.map((m) => m.id)).toEqual(["gpt-4o-mini", "claude-sonnet"]);
    });

    it("returns 502 without the upstream body when the proxy rejects the key", async () => {
      writeLiteLLM({ api_key: "sk-wrong", base_url: "http://localhost:4000" });
      globalThis.fetch = (async () =>
        new Response("Authentication Error, Invalid proxy server token passed. secret-detail", {
          status: 401,
        })) as unknown as typeof fetch;

      const res = await catalogRequest("/settings/ai-models?provider=litellm");
      expect(res.status).toBe(502);
      const body = (await res.json()) as { title: string; detail?: string };
      expect(body.title).toBe("Upstream Model Catalog Error");
      expect(body.detail).toBe("HTTP 401");
    });

    it("does not follow a redirect from the proxy", async () => {
      writeLiteLLM({ api_key: "sk-key", base_url: "http://localhost:4000" });
      let calls = 0;
      globalThis.fetch = (async () => {
        calls += 1;
        return new Response(null, { status: 302, headers: { location: "https://elsewhere.example/model/info" } });
      }) as unknown as typeof fetch;

      const res = await catalogRequest("/settings/ai-models?provider=litellm");
      expect(res.status).toBe(502);
      expect(calls).toBe(1);
    });
  });

  it("defaults free to false when the query param is missing", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(openRouterCatalogBody()), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const res = await catalogRequest("/settings/ai-models?provider=openrouter");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { free: boolean; models: Array<{ id: string }> } };
    expect(body.data.free).toBe(false);
    expect(body.data.models.map((m) => m.id)).toContain("openai/gpt-5.2");
  });
});
