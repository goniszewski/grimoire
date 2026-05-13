import { Hono, Context } from "hono";
import { settingsManager, redactSettings, validateSettingsPatch } from "../settings.js";
import { log } from "../logger.js";
import { resolveRuntimeSettings } from "../runtime-settings.js";

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
      const res = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmConfig.apiKey ? { Authorization: `Bearer ${llmConfig.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: llmConfig.model,
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
