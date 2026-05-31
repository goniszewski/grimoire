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

  it("POST /categories persists optional metadata fields", async () => {
    const res = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "AI Research",
        color: "#2563eb",
        icon: "brain",
        description: "Machine learning papers and agent notes",
        slug: "ai-research",
        is_archived: 1,
        is_public: 1,
      }),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as {
      data: {
        name: string;
        color: string | null;
        icon: string | null;
        description: string | null;
        slug: string | null;
        is_archived: 0 | 1;
        is_public: 0 | 1;
      };
    };
    expect(json.data).toMatchObject({
      name: "AI Research",
      color: "#2563eb",
      icon: "brain",
      description: "Machine learning papers and agent notes",
      slug: "ai-research",
      is_archived: 1,
      is_public: 1,
    });

    const listRes = await app.request("/categories");
    const listJson = await listRes.json() as { data: Array<typeof json.data> };
    expect(listJson.data[0]).toMatchObject({
      color: "#2563eb",
      icon: "brain",
      description: "Machine learning papers and agent notes",
      slug: "ai-research",
      is_archived: 1,
      is_public: 1,
    });
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

  it("PUT /categories/:id updates and clears metadata fields", async () => {
    const createRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Research",
        color: "#2563eb",
        icon: "brain",
        description: "Initial notes",
        slug: "research",
        is_archived: 0,
        is_public: 0,
      }),
    });
    const { data: cat } = await createRes.json() as { data: { id: string } };

    const updateRes = await app.request(`/categories/${cat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        color: null,
        icon: null,
        description: "Updated notes",
        slug: "research-updated",
        is_archived: 1,
        is_public: 1,
      }),
    });

    expect(updateRes.status).toBe(200);
    const json = await updateRes.json() as {
      data: {
        color: string | null;
        icon: string | null;
        description: string | null;
        slug: string | null;
        is_archived: 0 | 1;
        is_public: 0 | 1;
      };
    };
    expect(json.data).toMatchObject({
      color: null,
      icon: null,
      description: "Updated notes",
      slug: "research-updated",
      is_archived: 1,
      is_public: 1,
    });
  });

  it("validates category metadata fields", async () => {
    const badColor = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad Color", color: "blue" }),
    });
    expect(badColor.status).toBe(422);

    const badVisibility = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad Visibility", is_public: 2 }),
    });
    expect(badVisibility.status).toBe(422);
  });

  it("rejects duplicate category slugs", async () => {
    await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Research", slug: "research" }),
    });

    const duplicate = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Research Copy", slug: "research" }),
    });

    expect(duplicate.status).toBe(409);
  });

  it("rejects non-object JSON category request bodies", async () => {
    const postRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    expect(postRes.status).toBe(422);

    const createRes = await app.request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Research" }),
    });
    const { data: cat } = await createRes.json() as { data: { id: string } };

    const putRes = await app.request(`/categories/${cat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    expect(putRes.status).toBe(422);
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

  it("records manual category changes in the timeline", async () => {
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

    const updateRes = await app.request(`/categories/${child.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "JavaScript", parent_id: null }),
    });
    expect(updateRes.status).toBe(200);

    const deleteRes = await app.request(`/categories/${child.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const timelineRes = await app.request("/timeline?limit=10");
    expect(timelineRes.status).toBe(200);
    const timeline = await timelineRes.json() as {
      data: Array<{
        type: string;
        description: string;
        source: string;
        metadata: Record<string, unknown>;
      }>;
    };

    const createdEvents = timeline.data.filter((event) => event.type === "category_created");
    expect(createdEvents).toHaveLength(2);
    expect(createdEvents.some((event) => event.description === `Created category "Tech"`)).toBe(true);

    expect(timeline.data).toContainEqual(expect.objectContaining({
      type: "category_renamed",
      description: `Renamed category "TypeScript" to "JavaScript"`,
      source: "user",
      metadata: expect.objectContaining({
        categoryId: child.id,
        previousName: "TypeScript",
        name: "JavaScript",
      }),
    }));
    expect(timeline.data).toContainEqual(expect.objectContaining({
      type: "category_reparented",
      description: `Moved category "JavaScript" to root`,
      source: "user",
      metadata: expect.objectContaining({
        categoryId: child.id,
        previousParentId: parent.id,
        parentId: null,
      }),
    }));
    expect(timeline.data).toContainEqual(expect.objectContaining({
      type: "category_deleted",
      description: `Deleted category "JavaScript"`,
      source: "user",
      metadata: expect.objectContaining({
        categoryId: child.id,
        name: "JavaScript",
        parentId: null,
      }),
    }));
  });
});
