import { Context, Hono } from "hono";
import { Database } from "bun:sqlite";
import { IntegrationTokenRepository } from "../db/integration-token-repository.js";
import { SHORTCUT_FILENAME, generateShortcut } from "../integrations/apple-shortcut.js";

interface AppleShortcutDeps {
  db: Database;
  /** Override the generator (tests avoid invoking the macOS signing service). */
  generate?: typeof generateShortcut;
}

const DEFAULT_TOKEN_NAME = "Apple Shortcut";
const MAX_TOKEN_NAME_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 100;
const MAX_SERVER_URL_LENGTH = 2000;

function problem(c: Context, status: 400 | 415 | 422 | 503, title: string, detail?: string) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts only a bare http(s) origin; the shortcut appends `/capture` itself. */
function parseServerUrl(value: unknown): { origin: string } | { error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "`server_url` must be a non-empty string" };
  }
  const raw = value.trim();
  if (raw.length > MAX_SERVER_URL_LENGTH) {
    return { error: `\`server_url\` must be at most ${MAX_SERVER_URL_LENGTH} characters` };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "`server_url` must be an absolute http or https URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "`server_url` must use http or https" };
  }
  if (parsed.username || parsed.password) {
    return { error: "`server_url` must not contain credentials" };
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return { error: "`server_url` must be an origin without a path, query, or fragment" };
  }
  return { origin: parsed.origin };
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function parseOptionalText(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
): { value: string | undefined } | { error: string } {
  if (!(key in body) || body[key] === undefined) return { value: undefined };
  const raw = body[key];
  if (typeof raw !== "string") return { error: `\`${key}\` must be a string` };
  const trimmed = raw.trim();
  if (CONTROL_CHARS.test(trimmed)) return { error: `\`${key}\` must not contain control characters` };
  if (trimmed.length > maxLength) return { error: `\`${key}\` must be at most ${maxLength} characters` };
  return { value: trimmed || undefined };
}

export function createAppleShortcutRoute(deps: AppleShortcutDeps): Hono {
  const router = new Hono();
  const tokens = new IntegrationTokenRepository(deps.db);

  router.post("/integrations/apple-shortcut", async (c) => {
    if (!(c.req.header("content-type") ?? "").includes("application/json")) {
      return problem(c, 415, "Unsupported Media Type", "Request body must use application/json");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }
    if (!isRecord(body)) {
      return problem(c, 422, "Unprocessable Entity", "Request body must be a JSON object");
    }

    const server = parseServerUrl(body.server_url);
    if ("error" in server) return problem(c, 422, "Unprocessable Entity", server.error);

    const name = parseOptionalText(body, "name", MAX_TOKEN_NAME_LENGTH);
    if ("error" in name) return problem(c, 422, "Unprocessable Entity", name.error);

    const category = parseOptionalText(body, "category", MAX_CATEGORY_LENGTH);
    if ("error" in category) return problem(c, 422, "Unprocessable Entity", category.error);

    // Validation is finished before the token exists, so a rejected request never leaves a stray token.
    const created = tokens.create(name.value ?? DEFAULT_TOKEN_NAME);
    let shortcut: Awaited<ReturnType<typeof generateShortcut>>;
    try {
      shortcut = await (deps.generate ?? generateShortcut)({
        serverUrl: server.origin,
        token: created.token,
        category: category.value,
      });
    } catch (error) {
      tokens.revoke(created.record.id);
      throw error;
    }

    // On a Mac that failed to sign (offline, timeout) the file is unusable on iOS; do not leave its token behind.
    if (!shortcut.signed && shortcut.signAttempted) {
      tokens.revoke(created.record.id);
      return problem(
        c,
        503,
        "Signing Unavailable",
        "Apple's signing service could not be reached. Check the internet connection and try again."
      );
    }

    return c.body(shortcut.data, 200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${SHORTCUT_FILENAME}"`,
      "Cache-Control": "no-store",
      "X-Grimoire-Shortcut-Signed": shortcut.signed ? "true" : "false",
      "Access-Control-Expose-Headers": "Content-Disposition, X-Grimoire-Shortcut-Signed",
    });
  });

  return router;
}
