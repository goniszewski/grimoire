import { expect, test } from "@playwright/test";
import { makeApiBookmark } from "./api-fixtures";
import { installMockDaemon } from "./mock-daemon";

test.describe("Documented business requirements smoke", () => {
  test("saves a bookmark and retrieves it through keyword search", async ({ page }) => {
    const daemon = await installMockDaemon(page, { bookmarks: [] });

    await page.goto("/");

    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => daemon.requests.health).toBeGreaterThan(0);

    await page.getByRole("button", { name: /add your first bookmark/i }).click();
    await page.getByPlaceholder("https://example.com/article").fill("https://example.com/local-first-search");
    await page.getByRole("button", { name: /save bookmark/i }).click();

    await expect(page.getByText("Local-first Search Notes")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/1 result/i)).toBeVisible();

    await page.getByPlaceholder("Search bookmarks...").fill("local-first");

    await expect
      .poll(() => daemon.requests.searchQueries)
      .toContainEqual({ q: "local-first", mode: "keyword" });
    await expect(page.getByText("Local-first Search Notes")).toBeVisible();
    await expect(page.getByText(/1 result/i)).toBeVisible();
  });

  test("exposes browser import and JSON export flows", async ({ page }) => {
    const daemon = await installMockDaemon(page, {
      bookmarks: [
        makeApiBookmark({
          id: "bm-export-1",
          title: "Exportable Knowledge",
          description: "A bookmark available for JSON and CSV export.",
        }),
      ],
    });

    await page.goto("/");

    await page.getByRole("button", { name: /^Import$/ }).click();
    await expect(page.getByRole("heading", { name: /import bookmarks/i })).toBeVisible();
    await expect(page.getByText(/netscape bookmark html file/i)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "bookmarks.html",
      mimeType: "text/html",
      buffer: Buffer.from(
        '<!DOCTYPE NETSCAPE-Bookmark-file-1><TITLE>Bookmarks</TITLE><A HREF="https://example.com/imported">Imported</A>'
      ),
    });

    await expect(page.getByText(/1 bookmark queued for processing/i)).toBeVisible({ timeout: 5_000 });
    await expect.poll(() => daemon.requests.imports).toBe(1);
    await page.getByRole("button", { name: /^Done$/ }).click();

    await page.getByRole("button", { name: /^Export$/ }).click();
    await page.getByRole("menuitem", { name: /export as json/i }).click();

    await expect.poll(() => daemon.requests.exportFormats).toContain("json");
  });

  test("filters and exports read-later bookmarks", async ({ page }) => {
    const daemon = await installMockDaemon(page, {
      bookmarks: [
        makeApiBookmark({
          id: "bm-read-later-1",
          url: "https://example.com/read-later",
          domain: "example.com",
          title: "Saved For Later",
          read_later: 1,
        }),
        makeApiBookmark({
          id: "bm-normal-1",
          url: "https://example.com/reference",
          domain: "example.com",
          title: "Immediate Reference",
          read_later: 0,
        }),
      ],
    });

    await page.goto("/");

    await expect(page.getByText("Saved For Later")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Immediate Reference")).toBeVisible();

    await page.getByRole("button", { name: /^Read Later$/ }).click();

    await expect(page.getByText("Saved For Later")).toBeVisible();
    await expect(page.getByText("Immediate Reference")).toBeHidden();

    await page.getByRole("button", { name: /^Export$/ }).click();
    await page.getByRole("menuitem", { name: /export as json/i }).click();

    await expect
      .poll(() => daemon.requests.exportRequests)
      .toContainEqual({ format: "json", read_later: "true" });
  });

  test("covers settings, update checks, backup verification, and restore", async ({ page }) => {
    const daemon = await installMockDaemon(page, {
      bookmarks: [makeApiBookmark({ id: "bm-settings-1" })],
      aiProvider: "openai",
    });

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "LLM Provider" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Embedding Provider" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Backup & Restore" })).toBeVisible();

    await page.getByRole("button", { name: /check for updates/i }).click();
    await expect(page.getByText(/little imp 0\.1\.0-beta is up to date/i)).toBeVisible();
    await expect.poll(() => daemon.requests.updateChecks).toBe(1);

    await page.getByTitle("Verify backup integrity").click();
    await expect.poll(() => daemon.requests.verifiedBackups).toContain("smoke-backup-0");

    await page.getByRole("button", { name: /create backup now/i }).click();
    await expect.poll(() => daemon.requests.createdBackups).toBe(1);
    await expect(page.getByText("smoke-backup-1")).toBeVisible();

    await page.getByPlaceholder("2026-03-14T07-45-04-815Z").fill("smoke-backup-1");
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Restore", exact: true }).click();

    await expect.poll(() => daemon.requests.restoredBackups).toContain("smoke-backup-1");
  });
});
