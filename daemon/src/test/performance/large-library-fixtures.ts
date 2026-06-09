import type { Database } from "bun:sqlite";
import { packFloat32 } from "../../ai/embeddings.js";
import { EmbeddingRepository } from "../../db/embedding-repository.js";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

export const LARGE_LIBRARY_SIZE = 2_000;
export const VECTOR_BENCHMARK_DIMENSIONS = 768;
export const VECTOR_BENCHMARK_ITERATIONS = 3;
export const VECTOR_BENCHMARK_LIMIT = 10;
export const VECTOR_BENCHMARK_MODEL = "performance-vector-model";
export const VECTOR_BENCHMARK_SIZES = [100, 1_000, 5_000, 10_000] as const;

export const LARGE_LIBRARY_BUDGETS_MS = {
  listPage: 500,
  paginationPage: 500,
  keywordSearch: 800,
  categoryFilter: 500,
  tagFilter: 650,
  importPreview: 1_000,
  importCommit: 3_000,
} as const;

export interface PerformanceResult {
  name: string;
  elapsedMs: number;
  budgetMs?: number;
}

export interface LargeLibraryFixture {
  categoryIds: string[];
  tagNames: string[];
}

export interface VectorBenchmarkFixture {
  queryVector: number[];
}

export function createPerformanceApp(): {
  db: Database;
  queue: JobQueue;
  app: ReturnType<typeof createApp>;
} {
  const db = makeTestDb();
  const queue = new JobQueue();
  const app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-performance" });
  return { db, queue, app };
}

export function seedLargeLibrary(db: Database, size: number): LargeLibraryFixture {
  const categoryIds: string[] = [];
  const tagIds: string[] = [];
  const tagNames = Array.from({ length: 24 }, (_, index) => `topic-${index}`);

  const insertCategory = db.query<{ id: string }, [string]>(
    "INSERT INTO categories (name) VALUES (?) RETURNING id"
  );
  const insertTag = db.query<{ id: string }, [string]>(
    "INSERT INTO tags (name) VALUES (?) RETURNING id"
  );
  const insertBookmark = db.query<
    { id: string },
    [string, string, string, string, string, 0 | 1, 0 | 1, string, string | null, number, string | null]
  >(
    `INSERT INTO bookmarks (
       url, domain, title, description, category_id, is_pinned, read_later,
       created_at, read_at, opened_count, last_opened_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`
  );
  const insertContent = db.query<unknown, [string, string, string, string, number]>(
    `INSERT INTO bookmark_content (bookmark_id, markdown, summary, language, word_count)
     VALUES (?, ?, ?, ?, ?)`
  );
  const attachTag = db.query<unknown, [string, string]>(
    "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
  );

  db.transaction(() => {
    for (let index = 0; index < 12; index += 1) {
      const row = insertCategory.get(`Performance Category ${index}`)!;
      categoryIds.push(row.id);
    }

    for (const name of tagNames) {
      const row = insertTag.get(name)!;
      tagIds.push(row.id);
    }

    for (let index = 0; index < size; index += 1) {
      const categoryId = categoryIds[index % categoryIds.length]!;
      const domain = `perf-${index % 20}.example.com`;
      const hasLatencyTerm = index % 4 === 0;
      const title = `${hasLatencyTerm ? "Latency" : "Throughput"} benchmark note ${index}`;
      const createdAt = new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 100), index % 24, index % 60)).toISOString();
      const readAt = index % 5 === 0
        ? new Date(Date.UTC(2026, 1, 1 + Math.floor(index / 150), index % 24, 0)).toISOString()
        : null;
      const lastOpenedAt = index % 7 === 0
        ? new Date(Date.UTC(2026, 2, 1 + Math.floor(index / 150), index % 24, 0)).toISOString()
        : null;
      const bookmark = insertBookmark.get(
        `https://${domain}/library/item-${index}`,
        domain,
        title,
        hasLatencyTerm ? "Latency regression reference" : "General performance reference",
        categoryId,
        index % 11 === 0 ? 1 : 0,
        index % 6 === 0 ? 1 : 0,
        createdAt,
        readAt,
        index % 13,
        lastOpenedAt
      )!;

      insertContent.run(
        bookmark.id,
        `Large library markdown body ${index}. ${hasLatencyTerm ? "latency measurement budget" : "throughput measurement budget"} for deterministic search.`,
        hasLatencyTerm ? "Latency measurement summary" : "Throughput measurement summary",
        "en",
        90 + (index % 200)
      );

      const firstTag = tagIds[index % tagIds.length]!;
      const secondTag = tagIds[(index + 7) % tagIds.length]!;
      attachTag.run(bookmark.id, firstTag);
      attachTag.run(bookmark.id, secondTag);
    }
  })();

  db.exec("ANALYZE");

  return { categoryIds, tagNames };
}

export function makeDeterministicVector(index: number, dimensions: number): number[] {
  const values = Array.from({ length: dimensions }, (_, dimension) => {
    const first = Math.sin((index + 1) * (dimension + 3) * 0.017);
    const second = Math.cos(((index % 31) + 1) * (dimension + 5) * 0.011);
    return first + second;
  });
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? values : values.map((value) => value / norm);
}

export function seedVectorBenchmarkLibrary(
  db: Database,
  size: number,
  dimensions = VECTOR_BENCHMARK_DIMENSIONS,
  model = VECTOR_BENCHMARK_MODEL
): VectorBenchmarkFixture {
  const insertBookmark = db.query<
    { id: string },
    [string, string, string, string]
  >(
    `INSERT INTO bookmarks (url, domain, title, description)
     VALUES (?, ?, ?, ?)
     RETURNING id`
  );
  const insertEmbedding = db.query<
    unknown,
    [string, string, number, Uint8Array]
  >(
    `INSERT INTO embeddings (bookmark_id, model, dimensions, vector)
     VALUES (?, ?, ?, ?)`
  );
  const queryVector = makeDeterministicVector(0, dimensions);

  db.transaction(() => {
    for (let index = 0; index < size; index += 1) {
      const domain = `vector-${index % 40}.example.com`;
      const bookmark = insertBookmark.get(
        `https://${domain}/nearest/${index}`,
        domain,
        `Vector benchmark bookmark ${index}`,
        `Deterministic nearest-neighbor benchmark row ${index}`
      )!;
      insertEmbedding.run(
        bookmark.id,
        model,
        dimensions,
        packFloat32(makeDeterministicVector(index, dimensions))
      );
    }
  })();

  new EmbeddingRepository(db).rebuildVectorIndex();
  db.exec("ANALYZE");

  return { queryVector };
}

export function createLargeImportHtml(rowCount: number): string {
  const groupCount = 6;
  const rowsPerGroup = Math.ceil(rowCount / groupCount);
  const groups: string[] = [];

  for (let group = 0; group < groupCount; group += 1) {
    const rows: string[] = [];
    const start = group * rowsPerGroup;
    const end = Math.min(start + rowsPerGroup, rowCount);

    for (let index = start; index < end; index += 1) {
      rows.push(
        `      <DT><A HREF="https://import-large.example.com/item-${index}" ADD_DATE="${1_700_000_000 + index}" TAGS="topic-${index % 12},import-${group}">Imported Large Row ${index}</A>`
      );
    }

    groups.push(`    <DT><H3>Import Batch ${group + 1}</H3>
    <DL><p>
${rows.join("\n")}
    </DL><p>`);
  }

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Large Import Fixture</TITLE>
<H1>Large Import Fixture</H1>
<DL><p>
  <DT><H3>Performance Imports</H3>
  <DL><p>
${groups.join("\n")}
  </DL><p>
</DL><p>`;
}

export async function timeAsync(name: string, fn: () => Promise<void>): Promise<PerformanceResult> {
  const started = performance.now();
  await fn();
  return { name, elapsedMs: performance.now() - started };
}

export function timeSync(name: string, fn: () => void): PerformanceResult {
  const started = performance.now();
  fn();
  return { name, elapsedMs: performance.now() - started };
}

export function assertBudget(
  result: PerformanceResult,
  budgetMs: number
): asserts result is PerformanceResult & { budgetMs: number } {
  result.budgetMs = budgetMs;
  if (result.elapsedMs > budgetMs) {
    throw new Error(`${result.name} took ${result.elapsedMs.toFixed(1)}ms; budget is ${budgetMs}ms`);
  }
}
