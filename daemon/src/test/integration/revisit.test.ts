import { describe, it, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";
import { postponeUntil } from "../../db/revisit-repository.js";

type State = {
  data: {
    total: number;
    eligible: number;
    round: null | {
      position: number;
      size: number;
      completed: boolean;
      current: { id: string; read_at: string | null } | null;
      upcoming: { id: string }[];
      decisions: string[];
    };
  };
};

describe("Revisit rounds", () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  const json = (value: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  const state = async (): Promise<State["data"]> => (await (await app.request("/revisit")).json() as State).data;
  const start = async (): Promise<State["data"]> => (await (await app.request("/revisit/round", json({ size: 5 }))).json() as State).data;

  beforeEach(() => {
    db = makeTestDb();
    app = createApp({ db, queue: new JobQueue(), startTime: new Date(), version: "test" });
  });

  async function save(index: number, later = true): Promise<string> {
    const response = await app.request("/bookmarks", json({
      url: `https://example.com/${index}`,
      read_later: later ? 1 : 0,
      notes: `Reason ${index}`,
    }));
    expect(response.status).toBe(201);
    return (await response.json() as { data: { id: string } }).data.id;
  }

  it("keeps ordinary read and organization state when Done clears Later", async () => {
    const id = await save(1);
    await app.request(`/bookmarks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["research"], read_at: "2026-01-01T00:00:00Z" }) });
    expect((await start()).round?.current?.id).toBe(id);
    const opened = await app.request(`/bookmarks/${id}/open`, json({}));
    expect(opened.status).toBe(200);
    expect((await state()).round?.current?.id).toBe(id);
    const acted = await app.request("/revisit/action", json({ bookmark_id: id, action: "done" }));
    expect(acted.status).toBe(200);
    const bookmark = (await (await app.request(`/bookmarks/${id}`)).json() as { data: { read_later: number; read_at: string; tags: string[] } }).data;
    expect(bookmark.read_later).toBe(0);
    expect(bookmark.read_at).toBe("2026-01-01T00:00:00Z");
    expect(bookmark.tags).toEqual(["research"]);
    const undone = await app.request("/revisit/undo", { method: "POST" });
    expect(undone.status).toBe(200);
    expect((await state()).round?.current?.id).toBe(id);
    expect((await (await app.request(`/bookmarks/${id}`)).json() as { data: { read_later: number } }).data.read_later).toBe(1);
  });

  it("marks an unread card read, clears Later, and restores both on Undo", async () => {
    const id = await save(2);
    expect((await start()).round?.current?.read_at).toBeNull();
    const response = await app.request("/revisit/action", json({ bookmark_id: id, action: "read" }));
    expect(response.status).toBe(200);
    expect((await response.json() as State).data.round?.decisions).toEqual(["read"]);
    const bookmark = (await (await app.request(`/bookmarks/${id}`)).json() as { data: { read_later: number; read_at: string | null } }).data;
    expect(bookmark.read_later).toBe(0);
    expect(bookmark.read_at).not.toBeNull();
    await app.request("/revisit/undo", { method: "POST" });
    const restored = (await (await app.request(`/bookmarks/${id}`)).json() as { data: { read_later: number; read_at: string | null } }).data;
    expect(restored).toMatchObject({ read_later: 1, read_at: null });
    expect((await state()).round?.current?.id).toBe(id);
  });

  it("preserves an existing read timestamp when marking an already-read card read", async () => {
    const id = await save(3);
    const readAt = "2026-01-01T00:00:00Z";
    await app.request(`/bookmarks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read_at: readAt }) });
    expect((await start()).round?.current?.read_at).toBe(readAt);
    await app.request("/revisit/action", json({ bookmark_id: id, action: "read" }));
    const bookmark = (await (await app.request(`/bookmarks/${id}`)).json() as { data: { read_later: number; read_at: string } }).data;
    expect(bookmark).toMatchObject({ read_later: 0, read_at: readAt });
    await app.request("/revisit/undo", { method: "POST" });
    expect((await state()).round?.current?.read_at).toBe(readAt);
  });

  it("resumes a stable round and prevents a stale repeated action from advancing twice", async () => {
    for (let i = 0; i < 7; i++) await save(i);
    const first = (await start()).round!;
    expect((await start()).round?.current?.id).toBe(first.current?.id);
    const ids = new Set<string>([first.current!.id]);
    for (let i = 0; i < 5; i++) {
      const current = (await state()).round?.current;
      expect(current).not.toBeNull();
      ids.add(current!.id);
      const response = await app.request("/revisit/action", json({ bookmark_id: current!.id, action: "postponed" }));
      expect(response.status).toBe(200);
      if (i === 0) {
        const retry = await app.request("/revisit/action", json({ bookmark_id: current!.id, action: "postponed" }));
        expect(retry.status).toBe(409);
        expect((await state()).round?.position).toBe(1);
      }
    }
    expect(ids.size).toBe(5);
    const next = await start();
    expect(next.round?.current).not.toBeNull();
    expect(ids.has(next.round!.current!.id)).toBe(false);
  });

  it("skips through the stack without removing a bookmark from Later", async () => {
    for (let i = 0; i < 3; i++) await save(i);
    const first = (await start()).round!;
    expect(first.upcoming).toHaveLength(2);
    expect(new Set([first.current!.id, ...first.upcoming.map((item) => item.id)]).size).toBe(3);
    const response = await app.request("/revisit/action", json({ bookmark_id: first.current!.id, action: "skipped" }));
    expect(response.status).toBe(200);
    const next = (await response.json() as State).data.round!;
    expect(next.current?.id).toBe(first.upcoming[0].id);
    expect(next.decisions).toEqual(["skipped"]);
    expect((await (await app.request(`/bookmarks/${first.current!.id}`)).json() as { data: { read_later: number } }).data.read_later).toBe(1);
    await app.request("/revisit/undo", { method: "POST" });
    expect((await state()).round?.current?.id).toBe(first.current!.id);
  });

  it("postpones until the selected delay and restores Trash on Undo", async () => {
    const id = await save(1);
    await start();
    await app.request("/revisit/action", json({ bookmark_id: id, action: "postponed", delay: "week" }));
    expect((await state()).eligible).toBe(0);
    expect((await start()).round?.completed).toBe(true);
    await app.request("/revisit/undo", { method: "POST" });
    expect((await state()).eligible).toBe(1);
    await app.request("/revisit/action", json({ bookmark_id: id, action: "trashed" }));
    expect((await state()).total).toBe(0);
    await app.request("/revisit/undo", { method: "POST" });
    expect((await state()).total).toBe(1);
    expect((await state()).round?.current?.id).toBe(id);
  });

  it("advances past a current bookmark deleted outside Revisit", async () => {
    await save(11);
    await save(12);
    const first = (await start()).round!;
    db.query("DELETE FROM bookmarks WHERE id = ?").run(first.current!.id);
    const resumed = await state();
    expect(resumed.round?.completed).toBe(false);
    expect(resumed.round?.size).toBe(1);
    expect(resumed.round?.current?.id).not.toBe(first.current!.id);
    expect((await start()).round?.current?.id).toBe(resumed.round?.current?.id);
  });

  it("finishes a round when its remaining cards leave Later elsewhere", async () => {
    const id = await save(13);
    await start();
    db.query("UPDATE bookmarks SET read_later = 0 WHERE id = ?").run(id);
    expect((await state()).round).toMatchObject({ completed: true, current: null, size: 0 });
    expect((await start()).round?.completed).toBe(true);
  });

  it("clamps a one-month postponement to the target month's last day", () => {
    expect(postponeUntil(new Date("2025-01-31T15:30:00.000Z"), "month").toISOString())
      .toBe("2025-02-28T15:30:00.000Z");
    expect(postponeUntil(new Date("2024-01-31T15:30:00.000Z"), "month").toISOString())
      .toBe("2024-02-29T15:30:00.000Z");
  });

  it("reuses an existing active URL without overwriting its note", async () => {
    const id = await save(1, false);
    const response = await app.request("/bookmarks", json({ url: "https://example.com/1", read_later: 1, notes: "Replacement" }));
    expect(response.status).toBe(200);
    expect((await state()).total).toBe(1);
    const bookmark = (await (await app.request(`/bookmarks/${id}`)).json() as { data: { notes: string } }).data;
    expect(bookmark.notes).toBe("Reason 1");
  });

  it("rejects non-object mutation bodies", async () => {
    expect((await app.request("/revisit/round", json(null))).status).toBe(422);
    expect((await app.request("/revisit/action", json(null))).status).toBe(422);
  });
});
