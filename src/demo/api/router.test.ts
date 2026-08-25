import { beforeEach, describe, expect, it } from "vitest";
import { handleDemoRequest } from "./router";
import { resetDemoState } from "./state";

async function request(path: string, init?: RequestInit): Promise<Response> {
  return handleDemoRequest(new Request(`http://demo.test/__api${path}`, init));
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  return response.json() as Promise<T>;
}

describe("public demo API", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("lists only active fixture bookmarks and preserves pagination metadata", async () => {
    const response = await json<{
      data: Array<{ id: string }>;
      pagination: { total: number; limit: number; offset: number; has_more: boolean };
    }>("/bookmarks?limit=2");

    expect(response.pagination).toEqual({ total: 26, limit: 2, offset: 0, has_more: true });
    expect(response.data).toHaveLength(2);
    expect(response.data.every((bookmark) => bookmark.id !== "demo-029")).toBe(true);
  });

  it("searches fixture metadata and returns readable bookmark detail content", async () => {
    const search = await json<{ data: Array<{ id: string }> }>("/search?q=sqlite");
    expect(search.data.map((bookmark) => bookmark.id)).toContain("demo-007");
    expect(search.data.map((bookmark) => bookmark.id)).toContain("demo-009");

    const detail = await json<{
      data: { id: string; content: { markdown: string } | null; media: { favicon: null; screenshot: null; images: [] } };
    }>("/bookmarks/demo-009");
    expect(detail.data.id).toBe("demo-009");
    expect(detail.data.content?.markdown).toContain("SQLite foreign key support");
    expect(detail.data.media).toEqual({ favicon: null, screenshot: null, images: [] });
  });

  it("supports session mutations while keeping provider-backed modes unavailable", async () => {
    const created = await json<{ data: { id: string; tags: string[] } }>("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/demo-session" }),
    });
    expect(created.data.id).toBe("demo-session-31");
    expect(created.data.tags).toEqual(["session", "demo"]);

    const hybrid = await request("/search?q=demo&mode=hybrid");
    expect(hybrid.status).toBe(422);
    await expect(hybrid.json()).resolves.toMatchObject({ title: "Search mode unavailable" });

    const settingsUpdate = await request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_enabled: true }),
    });
    expect(settingsUpdate.status).toBe(501);
  });

  it("keeps session bookmark ids unique after deleting an earlier session bookmark", async () => {
    const first = await json<{ data: { id: string } }>("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/first-session" }),
    });
    const second = await json<{ data: { id: string } }>("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/second-session" }),
    });

    expect(first.data.id).toBe("demo-session-31");
    expect(second.data.id).toBe("demo-session-32");

    await request(`/bookmarks/${first.data.id}`, { method: "DELETE" });
    await request(`/bookmarks/${first.data.id}/permanent`, { method: "DELETE" });

    const third = await json<{ data: { id: string } }>("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/third-session" }),
    });

    expect(third.data.id).toBe("demo-session-33");
    expect(third.data.id).not.toBe(second.data.id);
  });

  it("returns related bookmarks and a download response for export", async () => {
    const related = await json<{ data: Array<{ id: string }> }>("/bookmarks/demo-009/related");
    expect(related.data.length).toBeGreaterThan(0);
    expect(related.data.map((bookmark) => bookmark.id)).not.toContain("demo-009");

    const exportResponse = await request("/export?format=json");
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-disposition")).toContain("grimoire-demo.json");
    await expect(exportResponse.json()).resolves.toHaveLength(26);
  });
});
