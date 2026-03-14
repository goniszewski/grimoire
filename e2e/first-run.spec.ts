// e2e/first-run.spec.ts
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3210";

function makeBookmark(overrides: Record<string, unknown> = {}) {
  return {
    id: "bm-first-1",
    url: "https://example.com/article",
    domain: "example.com",
    title: "Example Article",
    description: null,
    status: "saved",
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
    tags: [],
    ...overrides,
  };
}

async function setupBaseMocks(
  page: Page,
  bookmarks: unknown[],
  aiProvider: "openai" | "ollama" | "none" = "none"
) {
  await page.route(`${BASE}/health`, (route) =>
    route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 1, queueSize: 0 } })
  );
  await page.route(`${BASE}/categories`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/domains**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/tags**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/suggestions**`, (route) =>
    route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
  );
  await page.route(`${BASE}/settings`, (route) =>
    route.fulfill({
      json: {
        data: {
          ai: { provider: aiProvider, openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
          embedding: { provider: "none", openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
        },
      },
    })
  );
  await page.route(`${BASE}/bookmarks**`, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({
        json: { data: [...bookmarks], pagination: { total: bookmarks.length, limit: 200, offset: 0, has_more: false } },
      });
    }
    if (method === "POST") {
      const body = route.request().postDataJSON();
      const bm = makeBookmark({ url: body.url, domain: new URL(body.url).hostname, title: "Example Article" });
      bookmarks.push(bm);
      return route.fulfill({ status: 201, json: { data: bm } });
    }
    return route.continue();
  });
}

test.describe("First-run experience", () => {
  test("empty library shows onboarding state with both CTAs", async ({ page }) => {
    await setupBaseMocks(page, []);
    await page.goto("/");

    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /add your first bookmark/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /import from browser/i })).toBeVisible();
  });

  test("adding a bookmark removes the empty-state", async ({ page }) => {
    const bookmarks: unknown[] = [];
    await setupBaseMocks(page, bookmarks);
    await page.goto("/");

    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });

    // Click the primary CTA to open the dialog
    await page.getByRole("button", { name: /add your first bookmark/i }).click();
    await expect(page.getByPlaceholder("https://example.com/article")).toBeVisible();

    await page.getByPlaceholder("https://example.com/article").fill("https://example.com/article");
    await page.getByRole("button", { name: /save bookmark/i }).click();

    // Dialog closes, empty state disappears
    await expect(page.getByText(/your library is empty/i)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Example Article")).toBeVisible({ timeout: 5_000 });
  });

  test("degraded banner appears when AI provider is none", async ({ page }) => {
    await setupBaseMocks(page, [], "none");
    await page.goto("/");

    await expect(
      page.getByText(/AI enrichment is disabled/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("degraded banner is dismissible and stays dismissed on reload", async ({ page }) => {
    await setupBaseMocks(page, [], "none");
    await page.goto("/");

    await expect(page.getByText(/AI enrichment is disabled/i)).toBeVisible({ timeout: 10_000 });

    // Dismiss
    await page.getByRole("button", { name: /dismiss/i }).click();
    await expect(page.getByText(/AI enrichment is disabled/i)).not.toBeVisible();

    // Reload — should still be dismissed (localStorage persisted)
    await page.reload();
    // Wait for the page to be interactive (positive anchor before asserting absence)
    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/AI enrichment is disabled/i)).not.toBeVisible();
  });

  test("degraded banner does NOT appear when AI provider is configured", async ({ page }) => {
    await setupBaseMocks(page, [], "openai");
    await page.goto("/");

    // Wait for the page to fully load (empty-state is the reliable anchor)
    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/AI enrichment is disabled/i)).not.toBeVisible();
  });
});

test.describe("Review Queue cold-start guard", () => {
  async function setupReviewMocks(page: Page, bookmarkTotal: number) {
    await page.route(`${BASE}/health`, (route) =>
      route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 1, queueSize: 0 } })
    );
    await page.route(`${BASE}/categories`, (route) =>
      route.fulfill({ json: { data: [] } })
    );
    await page.route(`${BASE}/domains**`, (route) =>
      route.fulfill({ json: { data: [] } })
    );
    await page.route(`${BASE}/tags**`, (route) =>
      route.fulfill({ json: { data: [] } })
    );
    await page.route(`${BASE}/settings`, (route) =>
      route.fulfill({
        json: {
          data: {
            ai: { provider: "openai", openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
            embedding: { provider: "none", openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
          },
        },
      })
    );
    await page.route(`${BASE}/suggestions**`, (route) =>
      route.fulfill({ json: { data: [], meta: { pending: 0 } } })
    );
    await page.route(`${BASE}/bookmarks**`, (route) =>
      route.fulfill({
        json: {
          data: [],
          pagination: { total: bookmarkTotal, limit: 1, offset: 0, has_more: bookmarkTotal > 1 },
        },
      })
    );
  }

  test("shows cold-start message when < 20 bookmarks", async ({ page }) => {
    await setupReviewMocks(page, 5);
    await page.goto("/review-queue");

    await expect(
      page.getByText(/needs at least 20 bookmarks/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("does NOT show cold-start message when >= 20 bookmarks", async ({ page }) => {
    await setupReviewMocks(page, 25);
    await page.goto("/review-queue");

    // Positive anchor: "All caught up" renders when no cold-start + no suggestions
    await expect(page.getByText(/all caught up/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/needs at least 20 bookmarks/i)).not.toBeVisible();
  });
});

test.describe("Daemon offline banner", () => {
  test("shows offline banner when daemon is unreachable on first launch", async ({ page }) => {
    // Make all daemon requests fail (network error)
    await page.route(`${BASE}/**`, (route) => route.abort("connectionrefused"));

    await page.goto("/");

    // DaemonOfflineBanner should appear once loading resolves
    await expect(
      page.getByText(/daemon offline/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
