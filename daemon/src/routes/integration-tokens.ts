import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { IntegrationTokenRepository } from "../db/integration-token-repository.js";

interface IntegrationTokenDeps {
  db: Database;
}

const DEFAULT_TOKEN_NAME = "Local integration";
const MAX_TOKEN_NAME_LENGTH = 120;

function problem(
  c: Context,
  status: 400 | 404 | 415 | 422,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDeclaredBody(c: Context): boolean {
  const contentLength = c.req.header("content-length");
  if (contentLength && Number(contentLength) > 0) return true;
  return c.req.header("transfer-encoding") !== undefined;
}

async function readOptionalJsonObject(c: Context): Promise<Record<string, unknown> | Response> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (hasDeclaredBody(c)) {
      return problem(c, 415, "Unsupported Media Type", "Request body must use application/json");
    }
    return {};
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

  return body;
}

function parseTokenName(body: Record<string, unknown>): { name: string } | { error: string } {
  if (!("name" in body)) return { name: DEFAULT_TOKEN_NAME };
  if (typeof body.name !== "string") {
    return { error: "`name` must be a string" };
  }

  const name = body.name.trim();
  if (!name) {
    return { error: "`name` must be a non-empty string" };
  }
  if (name.length > MAX_TOKEN_NAME_LENGTH) {
    return { error: `\`name\` must be at most ${MAX_TOKEN_NAME_LENGTH} characters` };
  }

  return { name };
}

export function createIntegrationTokensRoute(deps: IntegrationTokenDeps): Hono {
  const router = new Hono();
  const repo = new IntegrationTokenRepository(deps.db);

  router.get("/integration-tokens", (c) => {
    return ok(c, repo.list());
  });

  router.post("/integration-tokens", async (c) => {
    const body = await readOptionalJsonObject(c);
    if (body instanceof Response) return body;

    const parsed = parseTokenName(body);
    if ("error" in parsed) {
      return problem(c, 422, "Unprocessable Entity", parsed.error);
    }

    return ok(c, repo.create(parsed.name), 201);
  });

  router.post("/integration-tokens/:id/rotate", (c) => {
    const rotated = repo.rotate(c.req.param("id"));
    if (!rotated) return problem(c, 404, "Not Found", "Active integration token not found");
    return ok(c, rotated);
  });

  router.delete("/integration-tokens/:id", (c) => {
    const revoked = repo.revoke(c.req.param("id"));
    if (!revoked) return problem(c, 404, "Not Found", "Integration token not found");
    return c.body(null, 204);
  });

  return router;
}
