import { Hono, Context } from "hono";
import { settingsManager, redactSettings, validateSettingsPatch } from "../settings.js";
import { log } from "../logger.js";
import { resolveRuntimeSettings } from "../runtime-settings.js";
import { testProviderConnection } from "../ai/llm-provider.js";
import { listProviderModels } from "../ai/models-catalog.js";
import { normalizeHttpsBaseUrl } from "../lib/base-url.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function problem(
  c: Context,
  status: 400 | 403 | 422 | 500 | 502,
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
    return ok(c, {
      ...redactSettings(settings),
      runtime: resolveRuntimeSettings(settings).runtime,
    });
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
      return ok(c, {
        ...redactSettings(updated),
        runtime: resolveRuntimeSettings(updated).runtime,
      });
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
    const { provider } = settings.ai;
    const { llmConfig } = resolveRuntimeSettings(settings);

    if (!llmConfig) {
      const error = provider === "none"
        ? "AI provider is set to 'none'"
        : `AI provider '${provider}' is not fully configured`;
      return c.json({ ok: false, error });
    }

    try {
      const u = new URL(llmConfig.baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return c.json({ ok: false, error: "AI provider base URL must use http or https" });
      }
    } catch {
      return c.json({ ok: false, error: "AI provider base URL is not a valid URL" });
    }

    try {
      await testProviderConnection(llmConfig);
      return c.json({ ok: true });
    } catch (err) {
      log.warn("AI provider connectivity test failed", { provider, error: String(err) });
      return c.json({ ok: false, error: `Connection failed: ${String(err)}` });
    }
  });

  /**
   * GET /settings/ai-models?provider=openrouter&free=true
   * Lists models available from the configured provider (currently OpenRouter).
   * The OpenRouter catalog is public, so no API key is required.
   *
   * The endpoint triggers outbound requests on behalf of the browser, so it
   * requires the X-LittleImp-Frontend header that the app always sends. Foreign
   * web pages cannot set custom headers (preflights are rejected by
   * enforceLocalOrigin), which prevents blind `<img>`/`fetch` triggers.
   */
  app.get("/settings/ai-models", async (c) => {
    if (c.req.header("x-littleimp-frontend") !== "1") {
      return problem(c, 403, "Forbidden", "This endpoint requires the X-LittleImp-Frontend header");
    }
    const provider = c.req.query("provider");
    if (provider !== "openrouter") {
      return problem(c, 400, "Unsupported Provider",
        `Model catalog is not available for provider '${provider}'`);
    }
    const freeRaw = c.req.query("free") ?? "false";
    if (freeRaw !== "true" && freeRaw !== "false") {
      return problem(c, 400, "Invalid Query", "free must be 'true' or 'false'");
    }
    const free = freeRaw === "true";

    try {
      const settings = settingsManager.read();
      let baseUrl: string;
      try {
        baseUrl = normalizeHttpsBaseUrl(settings.ai.openrouter.base_url, OPENROUTER_BASE_URL);
      } catch (err) {
        return problem(c, 422, "Invalid Base URL",
          err instanceof Error ? err.message : "Configured OpenRouter base URL is invalid");
      }
      const result = await listProviderModels({
        provider: "openrouter",
        free,
        baseUrl,
      });
      return ok(c, result);
    } catch (err) {
      log.warn("AI model catalog fetch failed", { provider, free, error: String(err) });
      return problem(c, 502, "Upstream Model Catalog Error",
        err instanceof Error ? err.message : "Failed to fetch model catalog");
    }
  });

  return app;
}
