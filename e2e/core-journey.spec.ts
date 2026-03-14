import { test, expect, type Page, type Route } from "@playwright/test";

// ─── Shared fixture data ───────────────────────────────────────────────────────

const BASE = "http://127.0.0.1:3210";

function makeBookmark(overrides: Record<string, unknown> = {}) {
  return {
    id: "bm-test-1",
    url: "https://playwright.dev/docs/intro",
    domain: "playwright.dev",
    title: "Introduction | Playwright",
    description: "Playwright enables reliable end-to-end testing",
    status: "ai_enriched",
    category_id: null,
    favicon_url: null,
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ["testing", "e2e"],
    ...overrides,
  };
}

// ─── Mock daemon routes ────────────────────────────────────────────────────────

async function setupDaemonMocks(page: Page, bookmarks: unknown[] = []) {
  // Health
  await page.route(`${BASE}/health`, (route) =>
    route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 100, queueSize: 0 } })
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
      json: {
        data: {
          ai: { provider: "none", openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
          embedding: { provider: "none", openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
        },
      },
    })
  );

  // Bookmark list
  await page.route(`${BASE}/bookmarks**`, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ json: { data: bookmarks } });
    }
    if (method === "POST") {
      const body = route.request().postDataJSON();
      const bm = makeBookmark({ url: body.url, domain: new URL(body.url).hostname });
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
        return route.fulfill({ json: { data: [...bookmarks] } });
      }
      if (method === "POST") {
        const body = route.request().postDataJSON();
        const bm = makeBookmark({
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
    const bm = makeBookmark();
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

    // Detail panel/drawer should open — the URL link is a unique detail indicator
    await expect(page.getByRole("link", { name: /playwright\.dev\/docs\/intro/ })).toBeVisible({ timeout: 3_000 });
  });

  test("archive bookmark disappears from main feed", async ({ page }) => {
    const bm = makeBookmark();
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
    const archivedBm = makeBookmark({ is_archived: 1 });

    // Archive page fetches with is_archived=1
    await page.route(`${BASE}/bookmarks**`, (route) => {
      const url = route.request().url();
      if (url.includes("is_archived=1") || url.includes("archive")) {
        return route.fulfill({ json: { data: [archivedBm] } });
      }
      return route.fulfill({ json: { data: [] } });
    });
    await page.route(`${BASE}/health`, (route) =>
      route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 100, queueSize: 0 } })
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
    const trashedBm = makeBookmark({ is_trashed: 1, trashed_at: new Date().toISOString() });

    await page.route(`${BASE}/trash`, (route) =>
      route.fulfill({ json: { data: [trashedBm] } })
    );
    await page.route(`${BASE}/health`, (route) =>
      route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 100, queueSize: 0 } })
    );
    await page.route(`${BASE}/categories`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/domains**`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/suggestions**`, (route) =>
      route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
    );
    await page.route(`${BASE}/tags**`, (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`${BASE}/bookmarks**`, (route) =>
      route.fulfill({ json: { data: [] } })
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
