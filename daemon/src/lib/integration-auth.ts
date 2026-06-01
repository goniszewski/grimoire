import type { Context, Next } from "hono";
import type { Database } from "bun:sqlite";
import { IntegrationTokenRepository } from "../db/integration-token-repository.js";

const BEARER_REALM = 'Bearer realm="littleimp-local-integrations"';

function unauthorized(c: Context, detail: string): Response {
  c.header("WWW-Authenticate", BEARER_REALM);
  return c.json(
    {
      type: "https://littleimp.app/problems/integration-token-required",
      title: "Unauthorized",
      status: 401,
      detail,
    },
    401,
    { "Content-Type": "application/problem+json" }
  );
}

function bearerToken(c: Context): string | null {
  const raw = c.req.header("authorization");
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

export function requireIntegrationToken(db: Database) {
  const repo = new IntegrationTokenRepository(db);

  return async (c: Context, next: Next): Promise<Response | void> => {
    if (c.req.method === "OPTIONS") {
      await next();
      return;
    }

    const token = bearerToken(c);
    if (!token) {
      return unauthorized(c, "A managed integration bearer token is required for this route");
    }

    const record = repo.verify(token);
    if (!record) {
      return unauthorized(c, "The integration bearer token is invalid, rotated, or revoked");
    }

    await next();
  };
}

export function validatePresentedIntegrationToken(db: Database, skipPaths: ReadonlySet<string> = new Set()) {
  const repo = new IntegrationTokenRepository(db);

  return async (c: Context, next: Next): Promise<Response | void> => {
    if (c.req.method === "OPTIONS" || skipPaths.has(c.req.path)) {
      await next();
      return;
    }

    const raw = c.req.header("authorization");
    if (!raw) {
      await next();
      return;
    }

    const token = bearerToken(c);
    if (!token) {
      return unauthorized(c, "Authorization must use a bearer integration token");
    }

    const record = repo.verify(token);
    if (!record) {
      return unauthorized(c, "The integration bearer token is invalid, rotated, or revoked");
    }

    await next();
  };
}
