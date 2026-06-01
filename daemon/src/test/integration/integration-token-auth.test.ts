import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

type IntegrationTokenRecord = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type IntegrationTokenCreateResponse = {
  data: {
    token: string;
    record: IntegrationTokenRecord;
  };
};

type IntegrationTokenListResponse = {
  data: IntegrationTokenRecord[];
};

function mcpInitializeBody(): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "little-imp-test", version: "1.0.0" },
    },
  });
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

describe("integration token authentication", () => {
  let db: Database;
  let queue: JobQueue;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = makeTestDb();
    queue = new JobQueue(db);
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });
  });

  afterEach(() => {
    db.close();
  });

  async function createToken(name = "MCP local client"): Promise<IntegrationTokenCreateResponse["data"]> {
    const res = await app.request("/integration-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3210",
      },
      body: JSON.stringify({ name }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as IntegrationTokenCreateResponse;
    return json.data;
  }

  async function callMcp(headers: HeadersInit = {}): Promise<Response> {
    return await app.request("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: mcpInitializeBody(),
    });
  }

  it("creates and lists integration tokens without exposing the secret token", async () => {
    const created = await createToken("Raycast MCP");

    expect(created.token).toMatch(/^limp_it_[A-Za-z0-9_-]{43}$/);
    expect(created.record.name).toBe("Raycast MCP");
    expect(created.record.token_prefix).toBe(created.token.slice(0, 16));
    expect(created.record.last_used_at).toBeNull();
    expect(created.record.revoked_at).toBeNull();

    const listRes = await app.request("/integration-tokens");
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as IntegrationTokenListResponse;
    expect(list.data).toEqual([created.record]);
    expect(JSON.stringify(list)).not.toContain(created.token);
  });

  it("rejects non-JSON token create bodies instead of silently ignoring them", async () => {
    const res = await app.request("/integration-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "14",
        Origin: "http://127.0.0.1:3210",
      },
      body: '{"name":"MCP"}',
    });

    expect(res.status).toBe(415);
  });

  it("requires managed bearer tokens for MCP and records successful use", async () => {
    const missing = await callMcp();
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");

    const invalid = await callMcp(bearer("limp_it_invalid"));
    expect(invalid.status).toBe(401);

    const { token, record } = await createToken();
    const valid = await callMcp(bearer(token));
    expect(valid.status).not.toBe(401);

    const listRes = await app.request("/integration-tokens");
    const list = (await listRes.json()) as IntegrationTokenListResponse;
    const used = list.data.find((item) => item.id === record.id);
    expect(used?.last_used_at).toEqual(expect.any(String));
  });

  it("invalidates rotated and revoked integration tokens", async () => {
    const created = await createToken("Rotating client");

    const rotateRes = await app.request(`/integration-tokens/${created.record.id}/rotate`, {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3210" },
    });
    expect(rotateRes.status).toBe(200);
    const rotated = (await rotateRes.json()) as IntegrationTokenCreateResponse;
    expect(rotated.data.token).toMatch(/^limp_it_[A-Za-z0-9_-]{43}$/);
    expect(rotated.data.token).not.toBe(created.token);

    const oldToken = await callMcp(bearer(created.token));
    expect(oldToken.status).toBe(401);

    const newToken = await callMcp(bearer(rotated.data.token));
    expect(newToken.status).not.toBe(401);

    const revokeRes = await app.request(`/integration-tokens/${created.record.id}`, {
      method: "DELETE",
      headers: { Origin: "http://127.0.0.1:3210" },
    });
    expect(revokeRes.status).toBe(204);

    const revoked = await callMcp(bearer(rotated.data.token));
    expect(revoked.status).toBe(401);
  });

  it("keeps first-party bookmark writes tokenless after tokens exist", async () => {
    await createToken();

    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3210",
      },
      body: JSON.stringify({ url: "https://example.com/tokenless-first-party" }),
    });

    expect(res.status).toBe(201);
  });

  it("validates presented bearer tokens on regular REST routes without requiring them", async () => {
    const { token } = await createToken("REST client");

    const tokenless = await app.request("/bookmarks");
    expect(tokenless.status).toBe(200);

    const invalid = await app.request("/bookmarks", {
      headers: bearer("limp_it_invalid"),
    });
    expect(invalid.status).toBe(401);

    const valid = await app.request("/bookmarks", {
      headers: bearer(token),
    });
    expect(valid.status).toBe(200);
  });
});
