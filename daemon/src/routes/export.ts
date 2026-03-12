import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { BookmarkRepository, FilterOptions } from "../db/bookmark-repository.js";

interface ExportDeps {
  db: Database;
}

const CSV_HEADERS = ["id", "url", "title", "summary", "tags", "category", "domain", "created_at"];

function escapeCSV(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r/g, " ");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function createExportRoute(deps: ExportDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);

  router.get("/export", (c) => {
    const format = c.req.query("format") ?? "json";
    if (format !== "json" && format !== "csv") {
      return c.json({ error: "format must be 'json' or 'csv'" }, 400);
    }

    const filters: FilterOptions = {
      tag: c.req.query("tag") ?? undefined,
      domain: c.req.query("domain") ?? undefined,
      category: c.req.query("category") ?? undefined,
      date_from: c.req.query("date_from") ?? undefined,
      date_to: c.req.query("date_to") ?? undefined,
    };

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
          r.id,
          escapeCSV(r.url),
          escapeCSV(r.title),
          escapeCSV(r.summary),
          escapeCSV(r.tags.join(";")),
          escapeCSV(r.category),
          r.domain,
          r.created_at,
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
