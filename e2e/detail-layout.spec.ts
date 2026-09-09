import { expect, test } from "@playwright/test";
import { BASE } from "./api-fixtures";
import { installMockDaemon } from "./mock-daemon";
import { stressBookmark, stressContent, stressMedia } from "./detail-stress-fixture";

for (const width of [320, 390, 768, 1920]) {
  test(`long bookmark details fit and remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("littleimp_guided_tour_dismissed", "true"));
    await installMockDaemon(page, { bookmarks: [stressBookmark] });
    await page.route(`${BASE}/bookmarks/${stressBookmark.id}`, route => route.fulfill({ json: { data: { ...stressBookmark, content: stressContent, media: stressMedia } } }));
    await page.goto("/");
    const search = page.getByRole("textbox", { name: "Search bookmarks", exact: true });
    if (width < 768) {
      await expect(search).toHaveAttribute("placeholder", "Search…");
      expect(await search.evaluate(el => {
        const style = getComputedStyle(el);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        context.font = style.font;
        return context.measureText((el as HTMLInputElement).placeholder).width <= el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      })).toBe(true);
    }
    await page.getByRole("link", { name: stressBookmark.title!, exact: true }).click();
    const scroller = page.getByTestId("bookmark-detail-scroll");
    await expect(page.getByRole("button", { name: "Enlarge image: Portrait reference", exact: true })).toBeAttached();
    expect(await scroller.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    // Both scrollable Markdown and ordinary notes must fit without horizontal clipping.
    for (const prose of await scroller.locator(".prose").all()) {
      expect(await prose.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    for (const trigger of await page.getByRole("button", { name: /^Enlarge image:/ }).all()) {
      await trigger.click();
      const preview = page.getByRole("dialog", { name: "Image preview", exact: true });
      await expect(preview).toBeVisible();
      expect(await preview.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const image = preview.locator("img");
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(preview).not.toBeVisible();
      await expect(scroller).toBeVisible();
    }
    await scroller.getByRole("link", { name: "Open", exact: true }).scrollIntoViewIfNeeded();
    await expect(scroller.getByRole("link", { name: "Open", exact: true })).toBeInViewport();
  });
}
