import { Hono, type Context } from "hono";
import { Database } from "bun:sqlite";
import { RevisitRepository } from "../db/revisit-repository.js";

function problem(c: Context, status: 400 | 409 | 422, title: string, detail?: string) {
  return c.json({
    type: `https://littleimp.app/problems/${title.toLowerCase().replace(/\s+/g, "-")}`,
    title, status, detail,
  }, status, { "Content-Type": "application/problem+json" });
}

export function createRevisitRoute(db: Database): Hono {
  const router = new Hono();
  const repo = new RevisitRepository(db);

  router.get("/revisit", (c) => c.json({ data: repo.state() }));
  router.post("/revisit/round", async (c) => {
    let size = 5;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Invalid JSON");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return problem(c, 422, "Invalid round request");
    }
    const requestedSize = (body as { size?: unknown }).size;
    if (requestedSize !== undefined) {
      if (requestedSize !== 5 && requestedSize !== 10 && requestedSize !== 20) {
        return problem(c, 422, "Invalid round size");
      }
      size = requestedSize;
    }
    return c.json({ data: repo.start(size) });
  });
  router.post("/revisit/action", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Invalid JSON");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return problem(c, 422, "Invalid Revisit action");
    }
    const actionBody = body as { bookmark_id?: unknown; action?: unknown; delay?: unknown };
    if (typeof actionBody.bookmark_id !== "string" ||
        !["read", "done", "skipped", "postponed", "trashed"].includes(String(actionBody.action)) ||
        (actionBody.delay !== undefined && !["day", "week", "month"].includes(String(actionBody.delay)))) {
      return problem(c, 422, "Invalid Revisit action");
    }
    const result = repo.act(actionBody.bookmark_id, actionBody.action as "read" | "done" | "skipped" | "postponed" | "trashed",
      (actionBody.delay ?? "day") as "day" | "week" | "month");
    if (!result) return problem(c, 409, "Round changed", "Refresh the round before acting again.");
    return c.json({ data: result });
  });
  router.post("/revisit/undo", (c) => {
    const result = repo.undo();
    if (!result) return problem(c, 409, "Nothing to undo");
    return c.json({ data: result });
  });
  return router;
}
