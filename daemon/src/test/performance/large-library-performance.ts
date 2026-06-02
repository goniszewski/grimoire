import {
  LARGE_LIBRARY_BUDGETS_MS,
  LARGE_LIBRARY_SIZE,
  assertBudget,
  createLargeImportHtml,
  createPerformanceApp,
  seedLargeLibrary,
  timeAsync,
} from "./large-library-fixtures.js";

type PagedResponse = {
  data: Array<{ id: string; category_id?: string | null; tags?: string[] }>;
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
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
    const response = await context.app.request("/bookmarks?limit=50&offset=950");
    const json = await expectJson<PagedResponse>(response, 200);
    if (json.data.length !== 50 || json.pagination.offset !== 950) {
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
  assertBudget(commit, LARGE_LIBRARY_BUDGETS_MS.importCommit);

  for (const result of [list, pagination, search, categoryFilter, tagFilter, preview, commit]) {
    console.log(`${result.name}: ${result.elapsedMs.toFixed(1)}ms / ${result.budgetMs}ms`);
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
