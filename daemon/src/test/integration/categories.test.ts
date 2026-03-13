import { describe, it, expect, beforeEach } from "bun:test";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("Categories API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = makeTestDb();
    const queue = new JobQueue();
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test" });
  });

  // ─── POST /categories ─────────────────────────────────────────────────────

  it("POST /categories creates a root category", async () => {
    const res = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { data: { id: string; name: string; parent_id: string | null } };
    expect(json.data.name).toBe("Tech");
    expect(json.data.parent_id).toBeNull();
    expect(json.data.id).toBeString();
  });

  it("POST /categories creates a child category at depth 1", async () => {
    const parentRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    const { data: parent } = await parentRes.json() as { data: { id: string } };

    const childRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "TypeScript", parent_id: parent.id }),
    });
    expect(childRes.status).toBe(201);
    const json = await childRes.json() as { data: { id: string; name: string; parent_id: string } };
    expect(json.data.name).toBe("TypeScript");
    expect(json.data.parent_id).toBe(parent.id);
  });

  it("POST /categories duplicate name under same parent returns 409", async () => {
    await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    const res2 = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    expect(res2.status).toBe(409);
  });

  // ─── PUT /categories/:id ──────────────────────────────────────────────────

  it("PUT /categories/:id renames a category", async () => {
    const createRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    const { data: cat } = await createRes.json() as { data: { id: string } };

    const updateRes = await app.request(`/categories/${cat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Technology" }),
    });
    expect(updateRes.status).toBe(200);
    const json = await updateRes.json() as { data: { name: string } };
    expect(json.data.name).toBe("Technology");
  });

  it("PUT /categories/:id reparents to root with parent_id: null", async () => {
    const parentRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    const { data: parent } = await parentRes.json() as { data: { id: string } };

    const childRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "TypeScript", parent_id: parent.id }),
    });
    const { data: child } = await childRes.json() as { data: { id: string } };

    // Reparent to root
    const reparentRes = await app.request(`/categories/${child.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: null }),
    });
    expect(reparentRes.status).toBe(200);
    const json = await reparentRes.json() as { data: { parent_id: string | null } };
    expect(json.data.parent_id).toBeNull();
  });

  it("PUT /categories/:id returns 404 for unknown id", async () => {
    const res = await app.request("/categories/does-not-exist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });

  // ─── DELETE /categories/:id ───────────────────────────────────────────────

  it("DELETE /categories/:id removes the category", async () => {
    const createRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ToDelete" }),
    });
    const { data: cat } = await createRes.json() as { data: { id: string } };

    const deleteRes = await app.request(`/categories/${cat.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    // Should no longer appear in tree
    const listRes = await app.request("/categories");
    const listJson = await listRes.json() as { data: Array<{ id: string }> };
    expect(listJson.data.some((c) => c.id === cat.id)).toBe(false);
  });

  it("DELETE /categories/:id returns 404 for unknown id", async () => {
    const res = await app.request("/categories/does-not-exist", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  // ─── GET /categories ──────────────────────────────────────────────────────

  it("GET /categories returns a tree structure", async () => {
    // Create parent + child
    const parentRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    const { data: parent } = await parentRes.json() as { data: { id: string } };

    await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "TypeScript", parent_id: parent.id }),
    });

    const listRes = await app.request("/categories");
    expect(listRes.status).toBe(200);
    const json = await listRes.json() as { data: Array<{ id: string; children: unknown[] }> };
    expect(Array.isArray(json.data)).toBe(true);

    const techNode = json.data.find((c) => c.id === parent.id);
    expect(techNode).toBeDefined();
    expect(Array.isArray(techNode!.children)).toBe(true);
    expect(techNode!.children.length).toBe(1);
  });
});
