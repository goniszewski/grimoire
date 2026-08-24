import { expect, test } from "@playwright/test";

test.describe("public demo", () => {
  test("browses fixture data, searches, and opens detail content", async ({ page }) => {
    const origins = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
    });

    await page.goto("/");
    await expect(page.getByText("Public demo")).toBeVisible();
    await expect(page.getByText("AI enrichment is disabled.")).toHaveCount(0);
    await page.getByText("Skip tour").click();
    await expect(page.locator('[data-testid="bookmark-results"]')).toBeVisible();
    await expect(page.getByText("26 results")).toBeVisible();

    const bannerContentBox = await page.getByTestId("demo-mode-banner-content").boundingBox();
    const sidebarTriggerBox = await page.getByRole("button", { name: "Toggle Sidebar" }).first().boundingBox();
    expect(bannerContentBox).not.toBeNull();
    expect(sidebarTriggerBox).not.toBeNull();
    expect(Math.abs((bannerContentBox?.x ?? 0) - (sidebarTriggerBox?.x ?? 0))).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
    expect(await page.evaluate(() => document.cookie)).toBe("");

    const search = page.getByPlaceholder("Search bookmarks...");
    await search.fill("SQLite");
    await expect(page.getByText("SQLite foreign key support")).toBeVisible();

    await page.getByText("SQLite foreign key support").click();
    await expect(page.getByRole("dialog")).toContainText("SQLite foreign key support");
    await expect(page.getByRole("dialog")).toContainText("This original demo note");
    await expect(page.getByRole("dialog").getByText("Indexed", { exact: true })).toHaveCount(1);

    expect([...origins]).toEqual([new URL(page.url()).origin]);
  });

  test("serves deep links and exports fixture data", async ({ page }) => {
    await page.goto("/tags/react");
    await expect(page).toHaveURL(/\/tags\/react$/);
    await expect(page.locator("body")).toContainText("react");
    await expect(page.locator("body")).toContainText("You Might Not Need an Effect");

    await page.goto("/");
    await page.getByText("Skip tour").click();
    await page.getByRole("button", { name: /Export/ }).click();
    expect(await page.evaluate(() => document.body.dataset.demoMode)).toBe("true");
    await expect.poll(() => page.evaluate(() => document.body.getAttribute("data-scroll-locked"))).toBe("1");
    expect(await page.evaluate(() => getComputedStyle(document.body).marginRight)).toBe("0px");
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingRight)).toBe("0px");
    const downloadPromise = page.waitForEvent("download");
    await page.getByText("Export as JSON").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("grimoire-demo.json");
  });

  test("resets session state and known demo-local storage", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Skip tour").click();
    await page.evaluate(() => {
      localStorage.setItem("little-imp-library-view-preferences", "{}");
      localStorage.setItem("little-imp-lock-hash", "demo-only-hash");
      localStorage.setItem("degraded_banner_dismissed", "true");
      localStorage.setItem("littleimp_update_dismissed_version", "v9.9.9");
    });

    await Promise.all([
      page.waitForEvent("framenavigated"),
      page.getByRole("button", { name: "Reset demo" }).click(),
    ]);
    await page.waitForFunction(() => document.readyState === "complete");
    await expect(page.getByText("Public demo")).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("little-imp-lock-hash"))).toBeNull();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("little-imp-library-view-preferences"))).toBeNull();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("degraded_banner_dismissed"))).toBeNull();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("littleimp_update_dismissed_version"))).toBeNull();
  });

  test("gates local-only settings and management actions", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Explore the real interface without a daemon")).toBeVisible();
    await expect(page.getByText("Backup & Restore")).toHaveCount(0);

    await page.goto("/tags");
    await expect(page.getByText("Tag management is local-only")).toBeVisible();
    await page.getByRole("button", { name: "Install Grimoire" }).click();
    await expect(page.getByRole("dialog")).toContainText("Manage tags is local-only");
    await page.getByRole("button", { name: "Keep exploring" }).click();

    await page.goto("/");
    await page.getByText("Skip tour").click();
    await page.getByRole("button", { name: "Editing categories requires installing Grimoire" }).click();
    await expect(page.getByRole("dialog")).toContainText("Edit categories is local-only");
  });
});
