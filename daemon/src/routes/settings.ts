import { Hono, Context } from "hono";
import { settingsManager, redactSettings, validateSettingsPatch } from "../settings.js";
import { log } from "../logger.js";
import { isPrivateHost } from "../lib/network.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function problem(
  c: Context,
  status: 400 | 422 | 500,
  title: string,
  detail?: string
) {
  return c.json(
    {
      type: `https://littleimp.app/problems/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status,
      detail,
    },
    status,
    { "Content-Type": "application/problem+json" }
  );
}

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data }, status);
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createSettingsRoute(): Hono {
  const app = new Hono();

  /**
   * GET /settings
   * Returns current settings. API keys are redacted (shown as "***" if set).
   */
  app.get("/settings", (c) => {
    const settings = settingsManager.read();
    return ok(c, redactSettings(settings));
  });

  /**
   * PUT /settings
   * Deep-merges the request body into current settings and persists.
   * API keys in the body are written as-is (empty string clears them).
   */
  app.put("/settings", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    const validationError = validateSettingsPatch(body);
    if (validationError) {
      return problem(c, 422, "Unprocessable Entity", validationError);
    }

    try {
      const updated = settingsManager.write(body as Parameters<typeof settingsManager.write>[0]);
      return ok(c, redactSettings(updated));
    } catch (err) {
      return problem(c, 500, "Internal Server Error", String(err));
    }
  });

  /**
   * POST /settings/test-ai
   * Tests connectivity to the configured LLM provider.
   * Returns { ok: true } or { ok: false, error: string }.
   */
  app.post("/settings/test-ai", async (c) => {
    const settings = settingsManager.read();
    const { provider, openai, ollama } = settings.ai;

    if (provider === "none") {
      return c.json({ ok: false, error: "AI provider is set to 'none'" });
    }

    let baseUrl: string;
    let apiKey: string;
    let model: string;

    if (provider === "openai") {
      if (!openai.api_key) {
        return c.json({ ok: false, error: "OpenAI API key is not configured" });
      }
      baseUrl = "https://api.openai.com/v1";
      apiKey = openai.api_key;
      model = openai.model;
    } else {
      // ollama — validate base_url to prevent SSRF
      const rawUrl = ollama.base_url.replace(/\/$/, "");
      try {
        const u = new URL(rawUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return c.json({ ok: false, error: "ollama.base_url must use http or https" });
        }
        if (isPrivateHost(u.hostname)) {
          return c.json({ ok: false, error: "ollama.base_url must not point to a private or loopback address" });
        }
      } catch {
        return c.json({ ok: false, error: "ollama.base_url is not a valid URL" });
      }
      baseUrl = rawUrl;
      apiKey = "";
      model = ollama.model;
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok || res.status === 400) {
        // 400 from OpenAI still means the API is reachable and auth is valid
        return c.json({ ok: true });
      }

      const text = (await res.text().catch(() => res.statusText)).slice(0, 500);
      return c.json({ ok: false, error: `Provider returned ${res.status}: ${text}` });
    } catch (err) {
      log.warn("AI provider connectivity test failed", { provider, error: String(err) });
      return c.json({ ok: false, error: `Connection failed: ${String(err)}` });
    }
  });

  return app;
}
