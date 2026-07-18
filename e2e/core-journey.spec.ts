import { test, expect, type Page, type Route } from "@playwright/test";
import { BASE, makeApiBookmark, makeHealthResponse, makeSettingsResponse } from "./api-fixtures";

// ─── Shared fixture data ───────────────────────────────────────────────────────

// ─── Mock daemon routes ────────────────────────────────────────────────────────

function paginatedBookmarks(url: string, rows: unknown[]) {
  const parsed = new URL(url);
  const limit = Math.max(1, Number.parseInt(parsed.searchParams.get("limit") ?? "200", 10) || 200);
  const offset = Math.max(0, Number.parseInt(parsed.searchParams.get("offset") ?? "0", 10) || 0);
  const data = rows.slice(offset, offset + limit);
  return {
    data,
    pagination: {
      total: rows.length,
      limit,
      offset,
      has_more: offset + data.length < rows.length,
    },
  };
}

async function setupDaemonMocks(page: Page, bookmarks: unknown[] = []) {
  // Health
  await page.route(`${BASE}/health`, (route) =>
    route.fulfill({ json: makeHealthResponse() })
  );

  // Categories
  await page.route(`${BASE}/categories`, (route) =>
    route.fulfill({ json: { data: [] } })
  );

  // Domains
  await page.route(`${BASE}/domains**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );

  // Tags
  await page.route(`${BASE}/tags**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );

  // Suggestions
  await page.route(`${BASE}/suggestions**`, (route) =>
    route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
  );

  // Settings
  await page.route(`${BASE}/settings`, (route) =>
    route.fulfill({
      json: makeSettingsResponse("none"),
    })
  );

  // Bookmark list
  await page.route(`${BASE}/bookmarks**`, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ json: paginatedBookmarks(route.request().url(), bookmarks) });
    }
    if (method === "POST") {
      const body = route.request().postDataJSON();
      const bm = makeApiBookmark({ url: body.url, domain: new URL(body.url).hostname });
      bookmarks.push(bm);
      return route.fulfill({ status: 201, json: { data: bm } });
    }
    return route.continue();
  });

  // Pipeline status
  await page.route(`${BASE}/bookmarks/*/status`, (route) =>
    route.fulfill({
      json: {
        data: {
          bookmarkId: "bm-test-1",
          bookmarkStatus: "ai_enriched",
          job: null,
        },
      },
    })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("littleimp_guided_tour_dismissed", "true");
  });
});

test.describe("Core bookmark journey", () => {
  test("app loads and shows empty state", async ({ page }) => {
    await setupDaemonMocks(page, []);
    await page.goto("/");
    // Empty state message
    await expect(page.getByText(/add your first bookmark/i)).toBeVisible({ timeout: 10_000 });
  });

  test("add bookmark via dialog and verify it appears in list", async ({ page }) => {
    const bookmarks: unknown[] = [];

    await setupDaemonMocks(page, bookmarks);

    // After POST, list re-fetches — update mock to return the created bookmark
    await page.route(`${BASE}/bookmarks**`, async (route: Route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === "GET" && !url.includes("/status")) {
        return route.fulfill({ json: paginatedBookmarks(route.request().url(), [...bookmarks]) });
      }
      if (method === "POST") {
        const body = route.request().postDataJSON();
        const bm = makeApiBookmark({
          url: body.url,
          domain: new URL(body.url).hostname,
          title: "Playwright Docs",
        });
        bookmarks.push(bm);
        return route.fulfill({ status: 201, json: { data: bm } });
      }
      return route.continue();
    });

    await page.goto("/");

    // Open Add Bookmark dialog
    await page.getByRole("button", { name: /add your first bookmark/i }).click();
    await expect(page.getByPlaceholder("https://example.com/article")).toBeVisible();

    // Fill in URL and submit
    await page.getByPlaceholder("https://example.com/article").fill("https://playwright.dev/docs/intro");
    await page.getByRole("button", { name: /save bookmark/i }).click();

    // Dialog should close
    await expect(page.getByPlaceholder("https://example.com/article")).not.toBeVisible();

    // Bookmark should appear in list
    await expect(page.getByText("Playwright Docs")).toBeVisible({ timeout: 5_000 });
  });

  test("open bookmark detail panel", async ({ page }) => {
    const bm = makeApiBookmark();
    await setupDaemonMocks(page, [bm]);

    await page.route(`${BASE}/bookmarks/bm-test-1`, (route) =>
      route.fulfill({ json: { data: { ...bm, content: null } } })
    );
    await page.route(`${BASE}/bookmarks/bm-test-1/related**`, (route) =>
      route.fulfill({ json: { data: [] } })
    );

    await page.goto("/");
    await expect(page.getByText("Introduction | Playwright")).toBeVisible({ timeout: 5_000 });
    await page.getByText("Introduction | Playwright").first().click();

    // Detail panel/drawer should open; the URL link is a unique detail indicator.
    await expect(page.getByRole("link", { name: /playwright\.dev\/docs\/intro/ })).toBeVisible({ timeout: 3_000 });
  });

  test("archive bookmark disappears from main feed", async ({ page }) => {
    const bm = makeApiBookmark();
    const bookmarks = [bm];

    await setupDaemonMocks(page, bookmarks);

    // PATCH to archive
    await page.route(`${BASE}/bookmarks/bm-test-1`, async (route) => {
      if (route.request().method() === "PUT") {
        bookmarks.splice(0, bookmarks.length); // remove from list
        return route.fulfill({ json: { data: { ...bm, is_archived: 1 } } });
      }
      route.continue();
    });

    await page.goto("/");
    await expect(page.getByText("Introduction | Playwright")).toBeVisible({ timeout: 5_000 });

    // Click archive button (hover to reveal)
    const card = page.locator(".rounded-lg").filter({ hasText: "Introduction | Playwright" }).first();
    await card.hover();
    await page.getByTitle("Archive").first().click();

    // After archive + re-fetch, bookmark should be gone from main feed
    await expect(page.getByText("Introduction | Playwright")).not.toBeVisible({ timeout: 3_000 });
  });

  test("archive page shows archived bookmarks", async ({ page }) => {
    const archivedBm = makeApiBookmark({ is_archived: 1 });

    // Archive page fetches with is_archived=1
    await page.route(`${BASE}/bookmarks**`, (route) => {
      const url = route.request().url();
      if (url.includes("is_archived=1") || url.includes("archive")) {
        return route.fulfill({ json: { data: [archivedBm] } });
      }
      return route.fulfill({ json: paginatedBookmarks(route.request().url(), []) });
    });
    await page.route(`${BASE}/health`, (route) =>
      route.fulfill({ json: makeHealthResponse() })
    );
    await page.route(`${BASE}/categories`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/domains**`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/suggestions**`, (route) =>
      route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
    );
    await page.route(`${BASE}/tags**`, (route) => route.fulfill({ json: { data: [] } }));

    await page.goto("/archive");
    await expect(page.getByText("Introduction | Playwright")).toBeVisible({ timeout: 5_000 });
  });

  test("trash page shows trashed bookmarks", async ({ page }) => {
    const trashedBm = makeApiBookmark({ is_trashed: 1, trashed_at: new Date().toISOString() });

    await page.route(`${BASE}/trash`, (route) =>
      route.fulfill({ json: { data: [trashedBm] } })
    );
    await page.route(`${BASE}/health`, (route) =>
      route.fulfill({ json: makeHealthResponse() })
    );
    await page.route(`${BASE}/categories`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/domains**`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/suggestions**`, (route) =>
      route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
    );
    await page.route(`${BASE}/tags**`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/bookmarks**`, (route) =>
      route.fulfill({ json: { data: [], pagination: { total: 0, limit: 200, offset: 0, has_more: false } } })
    );

    await page.goto("/trash");
    await expect(page.getByText("Introduction | Playwright")).toBeVisible({ timeout: 5_000 });
  });

  test("dialog shows validation error for invalid URL", async ({ page }) => {
    await setupDaemonMocks(page, []);
    await page.goto("/");

    await page.getByRole("button", { name: /add your first bookmark/i }).click();
    await page.getByPlaceholder("https://example.com/article").fill("not-a-url");
    await page.getByRole("button", { name: /save bookmark/i }).click();

    await expect(page.getByText(/valid url/i)).toBeVisible();
  });
});
