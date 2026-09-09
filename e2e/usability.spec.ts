import { expect, test } from "@playwright/test";
import { makeApiBookmark } from "./api-fixtures";
import { installMockDaemon } from "./mock-daemon";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("littleimp_guided_tour_dismissed", "true"));
  await installMockDaemon(page, { bookmarks: [
    makeApiBookmark({ id: "open-a", title: "Alpha reference", url: "https://example.com/alpha" }),
    makeApiBookmark({ id: "open-b", title: "Beta reference", url: "https://example.com/beta" }),
  ] });
});

test("appearance follows system changes and persists explicit overrides", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("combobox", { name: "Appearance", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("combobox", { name: "Appearance", exact: true }).click();
  await page.getByRole("option", { name: "Light", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("opens selected tabs with no opener, and preserves native title links", async ({ page, context }) => {
  await context.route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Reference page</title>Reference page" }));
  await page.goto("/");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("link", { name: "Alpha reference", exact: true }).click();
  await page.getByRole("link", { name: "Beta reference", exact: true }).click();
  await page.getByRole("button", { name: "Open selected (2)", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open selected (2)", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open selected (2)", exact: true }).click();
  const opened: import("@playwright/test").Page[] = [];
  context.on("page", (popup) => opened.push(popup));
  await page.getByRole("button", { name: "Open 2 tabs", exact: true }).click();
  await expect.poll(() => opened.length).toBe(2);
  await expect(page.getByRole("status").filter({ hasText: "2 tabs opened." })).toBeVisible();
  for (const popup of opened) {
    await expect(popup).toHaveTitle("Reference page");
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(await popup.evaluate(() => document.referrer)).toBe("");
    await popup.close();
  }
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open selected (2)", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Alpha reference", exact: true }).click({ button: "middle" });
  const popup = await popupPromise;
  await expect(popup).toHaveTitle("Reference page");
  await popup.close();
});
