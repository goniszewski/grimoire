// e2e/update-notification.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { BASE } from "./api-fixtures";
import type { UpdateCheckResultDto } from "../daemon/src/api/types";

const UPDATE_CHECK_URL = `${BASE}/updates/check`;

/**
 * Set up standard mocks so the app boots with a known state.
 * The health endpoint must return for the daemon to be considered online.
 */
async function setupBaseMocks(page: Page) {
  await page.route(`${BASE}/health`, (route) =>
    route.fulfill({
      json: { status: "ok", version: "0.0.0", uptime: 100, queueSize: 0 },
    })
  );
  await page.route(`${BASE}/settings`, (route) =>
    route.fulfill({
      json: {
        data: {
          ai: { provider: "none" },
          app: { autostart: false, theme: "dark", lock: { enabled: false, pin_hash: "" } },
          backup: { local: { destination_path: "" }, s3: { endpoint: "", bucket: "", access_key: "", secret_key: "", region: "us-east-1", prefix: "" }, schedule: { enabled: false, cron: "", retention_count: 7 } },
          runtime: {
            llm: { enabled: false, provider: "", model: null, base_url: null },
            embeddings: { enabled: false, provider: "openai", model: "", base_url: "" },
            capabilities: { enrichment: false, semantic_search: false, related_bookmarks: false, organization_agent: false },
          },
        },
      },
    })
  );
  await page.route(`${BASE}/bookmarks**`, (route) =>
    route.fulfill({ json: { data: [], pagination: { total: 0, limit: 20, offset: 0, has_more: false } } })
  );
  await page.route(`${BASE}/bookmarks/aggregates**`, (route) =>
    route.fulfill({ json: { data: { categories: [], tags: [], domains: [] } } })
  );
  await page.route(`${BASE}/categories`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/tags**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/domains**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/suggestions**`, (route) =>
    route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
  );
}

/**
 * Create an update check response that reports a newer version.
 */
function makeUpdateAvailableResponse(): { data: UpdateCheckResultDto } {
  return {
    data: {
      current_version: "0.1.0-beta",
      update_available: true,
      source: "https://github.com/goniszewski/little-imp/releases",
      channel: "stable",
      latest: {
        version: "0.2.0",
        tag: "v0.2.0",
        name: "v0.2.0",
        prerelease: false,
        published_at: "2026-07-15T00:00:00Z",
        url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0",
      },
    },
  };
}

function makeUpToDateResponse(): { data: UpdateCheckResultDto } {
  return {
    data: {
      current_version: "0.1.0-beta",
      update_available: false,
      source: "https://github.com/goniszewski/little-imp/releases",
      channel: "stable",
      latest: null,
    },
  };
}

test.describe("In-app update notification", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("littleimp_guided_tour_dismissed", "true");
    });
    await setupBaseMocks(page);
  });

  test("shows the update banner when a newer version is available", async ({ page }) => {
    // Arrange: update check returns a newer version
    await page.route(UPDATE_CHECK_URL, (route) =>
      route.fulfill({ json: makeUpdateAvailableResponse() })
    );

    // Act: navigate to the library page
    await page.goto("/");

    // Assert: the update banner is visible
    const banner = page.getByRole("note").filter({ hasText: /Grimoire v0\.2\.0 is available/ });
    await expect(banner).toBeVisible();
    // The dismiss button should be present
    await expect(banner.getByRole("button", { name: /Dismiss/i })).toBeVisible();
  });

  test("does not show the banner when the current version is up to date", async ({ page }) => {
    await page.route(UPDATE_CHECK_URL, (route) =>
      route.fulfill({ json: makeUpToDateResponse() })
    );

    await page.goto("/");

    // No banner with update text
    const banner = page.getByRole("note").filter({ hasText: /Grimoire.*is available/ });
    await expect(banner).not.toBeVisible();
  });

  test("does not show the banner when the daemon is unreachable", async ({ page }) => {
    // Don't mock the update check — it will fail to connect
    await page.goto("/");

    // Banner should not appear
    const banner = page.getByRole("note").filter({ hasText: /Grimoire.*is available/ });
    await expect(banner).not.toBeVisible();
  });

  test("dismisses the banner and keeps it dismissed after page reload", async ({ page }) => {
    await page.route(UPDATE_CHECK_URL, (route) =>
      route.fulfill({ json: makeUpdateAvailableResponse() })
    );

    await page.goto("/");

    // Banner should be visible
    const banner = page.getByRole("note").filter({ hasText: /Grimoire v0\.2\.0 is available/ });
    await expect(banner).toBeVisible();

    // Dismiss it
    await banner.getByRole("button", { name: /Dismiss/i }).click();

    // Banner should disappear
    await expect(banner).not.toBeVisible();

    // Reload the page — the debounce means the update check won't fire again
    // within 6 hours, so no banner
    await page.goto("/");
    await expect(banner).not.toBeVisible();
  });

  test("'View update' link navigates to the Settings page", async ({ page }) => {
    await page.route(UPDATE_CHECK_URL, (route) =>
      route.fulfill({ json: makeUpdateAvailableResponse() })
    );

    await page.goto("/");

    const banner = page.getByRole("note").filter({ hasText: /Grimoire v0\.2\.0 is available/ });
    await expect(banner).toBeVisible();

    // Click "View update"
    await banner.getByRole("button", { name: /View update/i }).click();

    // Should navigate to /settings
    await expect(page).toHaveURL(/\/settings/);
  });
});
