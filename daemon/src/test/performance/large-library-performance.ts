import {
  LARGE_LIBRARY_BUDGETS_MS,
  LARGE_LIBRARY_SIZE,
  VECTOR_BENCHMARK_DIMENSIONS,
  VECTOR_BENCHMARK_ITERATIONS,
  VECTOR_BENCHMARK_LIMIT,
  VECTOR_BENCHMARK_MODEL,
  VECTOR_BENCHMARK_SIZES,
  assertBudget,
  createLargeImportHtml,
  createPerformanceApp,
  seedLargeLibrary,
  seedVectorBenchmarkLibrary,
  timeAsync,
  timeSync,
} from "./large-library-fixtures.js";
import type { PerformanceResult } from "./large-library-fixtures.js";
import { EmbeddingRepository } from "../../db/embedding-repository.js";
import { SearchRepository } from "../../db/search-repository.js";

type PagedResponse = {
  data: Array<{
    id: string;
    category_id?: string | null;
    tags?: string[];
    domain?: string;
    created_at?: string;
    read_at?: string | null;
  }>;
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
};

type AggregateResponse = {
  data: {
    total: number;
    categories: Array<{ id: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    domains: Array<{ domain: string; count: number }>;
  };
};

type PreviewResponse = {
  data: {
    summary: {
      importableRows: number;
    };
    folders: string[][];
    tags: string[];
  };
};

type ImportResponse = {
  data: {
    importId: string;
    total: number;
    folders: number;
    warnings: number;
    progressUrl: string;
  };
};

type ImportProgressPayload = {
  queued: number;
  skipped: number;
  merged: number;
  restored: number;
  failed: number;
  total: number;
  done: boolean;
  error: string | null;
  result: {
    summary: {
      importableRows: number;
      created: number;
      failed: number;
      categoriesCreated: number;
    };
  } | null;
};

type VectorBenchmarkResult = {
  size: number;
  blobMs: number;
  sqliteVecMs: number | null;
};

type QueryPlanRow = {
  detail: string;
};

type QueryPlanResult = {
  name: string;
  details: string[];
};

async function expectJson<T>(response: Response, expectedStatus: number): Promise<T> {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus}, received ${response.status}: ${await response.text()}`);
  }
  return await response.json() as T;
}

function progressPayloadsFromSse(text: string): ImportProgressPayload[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)) as ImportProgressPayload);
}

async function waitForImportCompletion(
  app: ReturnType<typeof createPerformanceApp>["app"],
  progressUrl: string
): Promise<ImportProgressPayload> {
  const response = await app.request(progressUrl);
  if (response.status !== 200) {
    throw new Error(`Expected import progress stream, received ${response.status}: ${await response.text()}`);
  }

  const payloads = progressPayloadsFromSse(await response.text());
  const finalPayload = payloads[payloads.length - 1];
  if (!finalPayload?.done) {
    throw new Error("Import progress stream closed before reporting done=true");
  }
  if (finalPayload.error) {
    throw new Error(`Import progress reported an error: ${finalPayload.error}`);
  }
  return finalPayload;
}

async function expectBookmarkCount(app: ReturnType<typeof createPerformanceApp>["app"], expected: number): Promise<void> {
  const response = await app.request("/bookmarks?limit=1");
  const json = await expectJson<PagedResponse>(response, 200);
  if (json.pagination.total !== expected) {
    throw new Error(`Expected ${expected} bookmarks after import, found ${json.pagination.total}`);
  }
}

function withSqliteVecDisabled<T>(fn: () => T): T {
  const previous = process.env.LITTLEIMP_DISABLE_SQLITE_VEC;
  process.env.LITTLEIMP_DISABLE_SQLITE_VEC = "1";
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.LITTLEIMP_DISABLE_SQLITE_VEC;
    } else {
      process.env.LITTLEIMP_DISABLE_SQLITE_VEC = previous;
    }
  }
}

function timeNearest(
  repo: EmbeddingRepository,
  queryVector: number[]
): number {
  const result = timeSync("vector nearest", () => {
    for (let iteration = 0; iteration < VECTOR_BENCHMARK_ITERATIONS; iteration += 1) {
      const nearest = repo.findNearest(VECTOR_BENCHMARK_MODEL, queryVector, {
        limit: VECTOR_BENCHMARK_LIMIT,
      });
      if (nearest.length !== VECTOR_BENCHMARK_LIMIT) {
        throw new Error(
          `Expected ${VECTOR_BENCHMARK_LIMIT} vector results, received ${nearest.length}`
        );
      }
      if (nearest[0]?.score === undefined || nearest[0].score < nearest.at(-1)!.score) {
        throw new Error("Vector nearest-neighbor results were not sorted by descending score");
      }
    }
  });
  return result.elapsedMs / VECTOR_BENCHMARK_ITERATIONS;
}

function measureBlobVectorSearch(size: number): number {
  return withSqliteVecDisabled(() => {
    const context = createPerformanceApp();
    const fixture = seedVectorBenchmarkLibrary(context.db, size);
    const repo = new EmbeddingRepository(context.db);
    repo.findNearest(VECTOR_BENCHMARK_MODEL, fixture.queryVector, {
      limit: VECTOR_BENCHMARK_LIMIT,
    });
    const elapsedMs = timeNearest(repo, fixture.queryVector);
    context.db.close();
    return elapsedMs;
  });
}

function measureSqliteVecSearch(size: number): number | null {
  const context = createPerformanceApp();
  const fixture = seedVectorBenchmarkLibrary(context.db, size);
  const repo = new EmbeddingRepository(context.db);

  if (!repo.isVectorIndexAvailable(VECTOR_BENCHMARK_DIMENSIONS)) {
    context.db.close();
    return null;
  }

  repo.findNearest(VECTOR_BENCHMARK_MODEL, fixture.queryVector, {
    limit: VECTOR_BENCHMARK_LIMIT,
  });
  const elapsedMs = timeNearest(repo, fixture.queryVector);
  context.db.close();
  return elapsedMs;
}

function runVectorBenchmarks(): VectorBenchmarkResult[] {
  const sqliteVecDisabledByCaller = process.env.LITTLEIMP_DISABLE_SQLITE_VEC === "1";

  return VECTOR_BENCHMARK_SIZES.map((size) => {
    const blobMs = measureBlobVectorSearch(size);
    const sqliteVecMs = sqliteVecDisabledByCaller ? null : measureSqliteVecSearch(size);
    return { size, blobMs, sqliteVecMs };
  });
}

async function measureHybridSearch(): Promise<PerformanceResult> {
  const context = createPerformanceApp();
  const fixture = seedVectorBenchmarkLibrary(context.db, LARGE_LIBRARY_SIZE);
  const repo = new SearchRepository(context.db);
  const embeddings = new EmbeddingRepository(context.db);
  const vectorIndexWasAvailable = embeddings.isVectorIndexAvailable(VECTOR_BENCHMARK_DIMENSIONS);
  const originalFetch = globalThis.fetch;

  if (vectorIndexWasAvailable && LARGE_LIBRARY_SIZE > 4_096) {
    const allowedIds = new Set(
      context.db
        .query<{ id: string }, []>("SELECT id FROM bookmarks")
        .all()
        .map((row) => row.id)
    );
    const boundedFiltered = embeddings.findNearest(
      VECTOR_BENCHMARK_MODEL,
      fixture.queryVector,
      { limit: 3_000, allowedIds }
    );
    if (boundedFiltered.length !== 3_000) {
      throw new Error(
        `Expected 3,000 bounded filtered vector results, received ${boundedFiltered.length}`
      );
    }
    if (!embeddings.isVectorIndexAvailable(VECTOR_BENCHMARK_DIMENSIONS)) {
      throw new Error("Bounded filtered vector search disabled the sqlite-vec index");
    }

    const excludedBookmarkId = allowedIds.values().next().value;
    const maxBounded = embeddings.findNearest(
      VECTOR_BENCHMARK_MODEL,
      fixture.queryVector,
      { limit: 4_096, excludeBookmarkId: excludedBookmarkId }
    );
    if (maxBounded.length !== 4_096) {
      throw new Error(
        `Expected 4,096 max-bounded vector results, received ${maxBounded.length}`
      );
    }
    if (!embeddings.isVectorIndexAvailable(VECTOR_BENCHMARK_DIMENSIONS)) {
      throw new Error("Max-bounded vector fallback disabled the sqlite-vec index");
    }
  }

  globalThis.fetch = Object.assign(
    async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (url !== "http://performance.local/v1/embeddings" || init?.method !== "POST") {
        throw new Error(`Unexpected performance fetch: ${init?.method ?? "GET"} ${url}`);
      }
      return new Response(
        JSON.stringify({ data: [{ embedding: fixture.queryVector }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
    { preconnect: originalFetch.preconnect }
  );

  try {
    return await timeAsync("hybrid search", async () => {
      const result = await repo.search({
        q: "vector",
        mode: "hybrid",
        limit: 25,
        offset: 0,
        embeddingConfig: {
          baseUrl: "http://performance.local/v1",
          apiKey: "",
          model: VECTOR_BENCHMARK_MODEL,
        },
      });
      if (result.total !== LARGE_LIBRARY_SIZE || result.items.length !== 25) {
        throw new Error(
          `Expected ${LARGE_LIBRARY_SIZE} hybrid results and a 25-row page, received ${result.total}/${result.items.length}`
        );
      }
      if (
        vectorIndexWasAvailable &&
        !embeddings.isVectorIndexAvailable(VECTOR_BENCHMARK_DIMENSIONS)
      ) {
        throw new Error("Exhaustive hybrid fallback disabled the bounded sqlite-vec index");
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    context.db.close();
  }
}

function captureQueryPlans(context: ReturnType<typeof createPerformanceApp>, fixture: { categoryIds: string[] }): QueryPlanResult[] {
  const explain = (
    name: string,
    sql: string,
    params: Array<string | number>
  ): QueryPlanResult => ({
    name,
    details: context.db
      .query<QueryPlanRow, Array<string | number>>(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...params)
      .map((row) => row.detail),
  });

  const plans = [
    explain(
      "deep library page",
      `SELECT b.id FROM bookmarks b
       WHERE b.is_trashed = 0 AND b.is_archived = 0
       ORDER BY b.is_pinned DESC, b.created_at DESC, b.id ASC
       LIMIT ? OFFSET ?`,
      [50, Math.max(0, LARGE_LIBRARY_SIZE - 50)]
    ),
    explain(
      "keyword search",
      `SELECT b.id FROM bookmarks_fts fts
       JOIN bookmarks b ON b.id = fts.bookmark_id
       WHERE b.is_archived = 0 AND b.is_trashed = 0
         AND fts.bookmarks_fts MATCH ?
       ORDER BY bm25(bookmarks_fts, 10, 5, 5, 1), b.created_at DESC
       LIMIT ?`,
      ['"latency"', 25]
    ),
    explain(
      "combined tag/category filter",
      `SELECT b.id FROM bookmarks b
       WHERE b.is_archived = 0 AND b.is_trashed = 0
         AND b.category_id = ?
         AND b.id IN (
           SELECT bt.bookmark_id FROM bookmark_tags bt
           JOIN tags t ON t.id = bt.tag_id
           WHERE t.name = ? COLLATE NOCASE
         )
       ORDER BY b.is_pinned DESC, b.created_at DESC
       LIMIT ?`,
      [fixture.categoryIds[3]!, "topic-3", 30]
    ),
    explain(
      "date range filter",
      `SELECT b.id FROM bookmarks b
       WHERE b.is_archived = 0 AND b.is_trashed = 0
         AND b.created_at >= ? AND b.created_at <= ?
       ORDER BY b.created_at DESC
       LIMIT ?`,
      ["2026-01-01", "2026-01-05T23:59:59Z", 30]
    ),
  ];

  if (!plans[1]!.details.some((detail) => detail.includes("VIRTUAL TABLE INDEX"))) {
    throw new Error("Keyword query plan did not use the FTS5 virtual table index");
  }
  if (!plans[2]!.details.some((detail) => detail.includes("idx_bookmark_tags_tag"))) {
    throw new Error("Combined-filter query plan did not use the bookmark tag index");
  }

  return plans;
}

async function run(): Promise<void> {
  const context = createPerformanceApp();
  const fixture = seedLargeLibrary(context.db, LARGE_LIBRARY_SIZE);

  const list = await timeAsync("list first page", async () => {
    const response = await context.app.request("/bookmarks?limit=50");
    const json = await expectJson<PagedResponse>(response, 200);
    if (json.pagination.total !== LARGE_LIBRARY_SIZE) {
      throw new Error(`Expected ${LARGE_LIBRARY_SIZE} list total, received ${json.pagination.total}`);
    }
    if (json.data.length !== 50 || json.pagination.has_more !== true) {
      throw new Error("List pagination did not return the expected first page");
    }
  });
  assertBudget(list, LARGE_LIBRARY_BUDGETS_MS.listPage);

  const pagination = await timeAsync("list deep page", async () => {
    const deepOffset = Math.max(0, LARGE_LIBRARY_SIZE - 50);
    const response = await context.app.request(`/bookmarks?limit=50&offset=${deepOffset}`);
    const json = await expectJson<PagedResponse>(response, 200);
    if (json.data.length !== 50 || json.pagination.offset !== deepOffset) {
      throw new Error("Deep pagination did not return the expected page");
    }
  });
  assertBudget(pagination, LARGE_LIBRARY_BUDGETS_MS.paginationPage);

  const search = await timeAsync("keyword search", async () => {
    const response = await context.app.request("/search?q=latency&mode=keyword&limit=25");
    const json = await expectJson<PagedResponse>(response, 200);
    if (json.pagination.total < 100) {
      throw new Error(`Expected broad keyword results, received ${json.pagination.total}`);
    }
  });
  assertBudget(search, LARGE_LIBRARY_BUDGETS_MS.keywordSearch);

  const categoryFilter = await timeAsync("category filter", async () => {
    const response = await context.app.request(`/bookmarks?category_id=${fixture.categoryIds[2]}&limit=30`);
    const json = await expectJson<PagedResponse>(response, 200);
    if (json.pagination.total === 0 || json.data.some((bookmark) => bookmark.category_id !== fixture.categoryIds[2])) {
      throw new Error("Category filter returned unexpected rows");
    }
  });
  assertBudget(categoryFilter, LARGE_LIBRARY_BUDGETS_MS.categoryFilter);

  const tagFilter = await timeAsync("tag filter", async () => {
    const response = await context.app.request("/bookmarks?tag=topic-3&limit=30");
    const json = await expectJson<PagedResponse>(response, 200);
    if (json.pagination.total === 0 || json.data.some((bookmark) => !bookmark.tags?.includes("topic-3"))) {
      throw new Error("Tag filter returned unexpected rows");
    }
  });
  assertBudget(tagFilter, LARGE_LIBRARY_BUDGETS_MS.tagFilter);

  const domainFilter = await timeAsync("domain filter", async () => {
    const response = await context.app.request("/bookmarks?domain=perf-7.example.com&limit=30");
    const json = await expectJson<PagedResponse>(response, 200);
    if (
      json.pagination.total === 0 ||
      json.data.length !== 30 ||
      json.data.some((bookmark) => bookmark.domain !== "perf-7.example.com")
    ) {
      throw new Error("Domain filter returned unexpected rows");
    }
  });
  assertBudget(domainFilter, LARGE_LIBRARY_BUDGETS_MS.domainFilter);

  const dateFilter = await timeAsync("date range filter", async () => {
    const response = await context.app.request(
      "/bookmarks?date_from=2026-01-01&date_to=2026-01-05&limit=30"
    );
    const json = await expectJson<PagedResponse>(response, 200);
    if (
      json.pagination.total === 0 ||
      json.data.length !== 30 ||
      json.data.some(
        (bookmark) =>
          !bookmark.created_at ||
          bookmark.created_at < "2026-01-01" ||
          bookmark.created_at > "2026-01-05T23:59:59Z"
      )
    ) {
      throw new Error("Date range filter returned unexpected rows");
    }
  });
  assertBudget(dateFilter, LARGE_LIBRARY_BUDGETS_MS.dateFilter);

  const combinedFilter = await timeAsync("combined filters", async () => {
    const response = await context.app.request(
      `/bookmarks?tag=topic-3&category_id=${fixture.categoryIds[3]}&read_state=unread&limit=30`
    );
    const json = await expectJson<PagedResponse>(response, 200);
    if (
      json.pagination.total === 0 ||
      json.data.some(
        (bookmark) =>
          bookmark.category_id !== fixture.categoryIds[3] ||
          !bookmark.tags?.includes("topic-3") ||
          bookmark.read_at !== null
      )
    ) {
      throw new Error("Combined filters returned unexpected rows");
    }
  });
  assertBudget(combinedFilter, LARGE_LIBRARY_BUDGETS_MS.combinedFilter);

  const aggregates = await timeAsync("aggregate counts", async () => {
    const response = await context.app.request("/bookmarks/aggregates");
    const json = await expectJson<AggregateResponse>(response, 200);
    if (
      json.data.total !== LARGE_LIBRARY_SIZE ||
      json.data.categories.length !== 12 ||
      json.data.tags.length !== 24 ||
      json.data.domains.length !== 20
    ) {
      throw new Error("Aggregate counts did not cover the expected fixture distribution");
    }
  });
  assertBudget(aggregates, LARGE_LIBRARY_BUDGETS_MS.aggregates);

  const queryPlans = captureQueryPlans(context, fixture);

  const importHtml = createLargeImportHtml(240);
  const form = new FormData();
  form.append("file", new Blob([importHtml], { type: "text/html" }), "large-bookmarks.html");
  const preview = await timeAsync("import preview", async () => {
    const response = await context.app.request("/import/preview", { method: "POST", body: form });
    const json = await expectJson<PreviewResponse>(response, 200);
    if (json.data.summary.importableRows !== 240 || json.data.folders.length < 7 || json.data.tags.length < 12) {
      throw new Error("Import preview summary did not match the large fixture");
    }
  });
  assertBudget(preview, LARGE_LIBRARY_BUDGETS_MS.importPreview);

  const commitForm = new FormData();
  commitForm.append("file", new Blob([importHtml], { type: "text/html" }), "large-bookmarks.html");
  const commit = await timeAsync("import commit", async () => {
    const response = await context.app.request("/import", { method: "POST", body: commitForm });
    const json = await expectJson<ImportResponse>(response, 200);
    if (json.data.total !== 240 || json.data.warnings !== 0) {
      throw new Error("Import commit summary did not match the large fixture");
    }
    const progress = await waitForImportCompletion(context.app, json.data.progressUrl);
    const importSummary = progress.result?.summary;
    if (
      progress.total !== 240 ||
      progress.queued !== 240 ||
      progress.failed !== 0 ||
      progress.skipped !== 0 ||
      progress.merged !== 0 ||
      progress.restored !== 0 ||
      !importSummary ||
      importSummary.created !== 240 ||
      importSummary.failed !== 0 ||
      importSummary.importableRows !== 240 ||
      importSummary.categoriesCreated < 7 ||
      context.queue.size() !== 240
    ) {
      throw new Error("Import progress result did not match the large fixture");
    }
    await expectBookmarkCount(context.app, LARGE_LIBRARY_SIZE + 240);
  });
  const importCommitBudget = Math.max(
    LARGE_LIBRARY_BUDGETS_MS.importCommit,
    LARGE_LIBRARY_SIZE / 10
  );
  assertBudget(commit, importCommitBudget);

  const vectorBenchmarks = runVectorBenchmarks();
  for (const result of vectorBenchmarks) {
    if (
      result.size > 1_000 &&
      result.sqliteVecMs !== null &&
      result.sqliteVecMs >= result.blobMs
    ) {
      throw new Error(
        `sqlite-vec nearest-neighbor search was not faster than BLOB scan at ${result.size} embeddings`
      );
    }
  }

  const hybridSearch = await measureHybridSearch();
  assertBudget(hybridSearch, LARGE_LIBRARY_BUDGETS_MS.hybridSearch);

  for (const result of [
    list,
    pagination,
    search,
    categoryFilter,
    tagFilter,
    domainFilter,
    dateFilter,
    combinedFilter,
    aggregates,
    hybridSearch,
    preview,
    commit,
  ]) {
    console.log(`${result.name}: ${result.elapsedMs.toFixed(1)}ms / ${result.budgetMs}ms`);
  }

  console.log("query plans");
  for (const plan of queryPlans) {
    console.log(`  ${plan.name}: ${plan.details.join(" | ")}`);
  }

  console.log(
    `vector nearest-neighbor (${VECTOR_BENCHMARK_DIMENSIONS}d, k=${VECTOR_BENCHMARK_LIMIT}, average of ${VECTOR_BENCHMARK_ITERATIONS})`
  );
  for (const result of vectorBenchmarks) {
    const sqliteVec = result.sqliteVecMs === null
      ? "sqlite-vec unavailable"
      : `sqlite-vec ${result.sqliteVecMs.toFixed(2)}ms (${(result.blobMs / result.sqliteVecMs).toFixed(1)}x faster)`;
    console.log(`  ${result.size} embeddings: BLOB ${result.blobMs.toFixed(2)}ms; ${sqliteVec}`);
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
