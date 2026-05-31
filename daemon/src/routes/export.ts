import { Context, Hono } from "hono";
import { Database } from "bun:sqlite";
import { BookmarkRepository, FilterOptions } from "../db/bookmark-repository.js";

interface ExportDeps {
  db: Database;
}

const CSV_HEADERS = ["id", "url", "title", "summary", "tags", "category", "domain", "is_pinned", "read_later", "created_at"];

function escapeCSV(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r/g, " ");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseReadLaterFilter(value: string | null | undefined): 0 | 1 | undefined | "invalid" {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "true" || value === "1") return 1;
  if (value === "false" || value === "0") return 0;
  return "invalid";
}

function buildFilters(c: Context): FilterOptions | "invalid" {
  const readLater = parseReadLaterFilter(c.req.query("read_later"));
  if (readLater === "invalid") {
    return "invalid";
  }

  return {
    tag: c.req.query("tag") ?? undefined,
    domain: c.req.query("domain") ?? undefined,
    category: c.req.query("category") ?? undefined,
    date_from: c.req.query("date_from") ?? undefined,
    date_to: c.req.query("date_to") ?? undefined,
    read_later: readLater,
  };
}

export function createExportRoute(deps: ExportDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);

  router.get("/export", (c) => {
    const format = c.req.query("format") ?? "json";
    if (format !== "json" && format !== "csv") {
      return c.json({ error: "format must be 'json' or 'csv'" }, 400);
    }

    const filters = buildFilters(c);
    if (filters === "invalid") {
      return c.json({ error: "`read_later` must be true, false, 1, or 0" }, 422);
    }

    const rows = repo.exportAll(filters);

    if (format === "json") {
      const filename = `bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
      return new Response(JSON.stringify(rows, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV
    const filename = `bookmarks-${new Date().toISOString().slice(0, 10)}.csv`;
    const lines: string[] = [CSV_HEADERS.join(",")];
    for (const r of rows) {
      lines.push(
        [
          escapeCSV(r.id),
          escapeCSV(r.url),
          escapeCSV(r.title),
          escapeCSV(r.summary),
          escapeCSV(r.tags.join(";")),
          escapeCSV(r.category),
          escapeCSV(r.domain),
          escapeCSV(String(r.is_pinned)),
          escapeCSV(String(r.read_later)),
          escapeCSV(r.created_at),
        ].join(",")
      );
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });

  return router;
}
