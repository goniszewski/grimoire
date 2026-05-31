import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "..");
const reportsRoot = path.join(repoRoot, "docs", "task-reports");
const lightboxScript = path.join(reportsRoot, "assets", "task-report-lightbox.js");

function walkHtmlFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry);
      if (statSync(entryPath).isDirectory()) {
        return walkHtmlFiles(entryPath);
      }
      return entryPath.endsWith(".html") ? [entryPath] : [];
    })
    .sort();
}

function scriptReferenceFor(htmlFile: string): string {
  return path.relative(path.dirname(htmlFile), lightboxScript).split(path.sep).join("/");
}

function defineReadOnlyNumber(object: object, property: string, value: number): void {
  Object.defineProperty(object, property, { configurable: true, value });
}

function readImageSize(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + length;
    }
  }

  throw new Error(`Unsupported image format: ${filePath}`);
}

describe("task report image lightbox", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    delete (window as Window & { __littleImpTaskReportLightbox?: unknown }).__littleImpTaskReportLightbox;
  });

  it("is loaded by every task report HTML page that renders images", () => {
    expect(existsSync(lightboxScript)).toBe(true);

    const pagesWithImages = walkHtmlFiles(reportsRoot).filter((htmlFile) =>
      readFileSync(htmlFile, "utf8").includes("<img "),
    );

    expect(pagesWithImages.length).toBeGreaterThan(0);

    for (const htmlFile of pagesWithImages) {
      const html = readFileSync(htmlFile, "utf8");
      const expectedReference = scriptReferenceFor(htmlFile);

      expect(html, path.relative(repoRoot, htmlFile)).toContain(
        `<script src="${expectedReference}" defer></script>`,
      );
    }
  });

  it("opens clicked report images in a zoomable, draggable lightbox", () => {
    expect(existsSync(lightboxScript)).toBe(true);

    document.body.innerHTML = `
      <figure>
        <img src="assets/example.png" alt="Example screenshot">
        <figcaption>Example caption.</figcaption>
      </figure>
    `;

    window.eval(readFileSync(lightboxScript, "utf8"));

    document.querySelector("img")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const dialog = document.querySelector<HTMLElement>("[data-report-lightbox]");
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe("assets/example.png");
    expect(dialog?.querySelector("[data-report-lightbox-caption]")?.textContent).toBe("Example caption.");

    const image = dialog?.querySelector<HTMLElement>("[data-report-lightbox-image]");
    const zoomIn = dialog?.querySelector<HTMLElement>('[data-report-lightbox-action="zoom-in"]');
    const close = dialog?.querySelector<HTMLElement>('[data-report-lightbox-action="close"]');

    zoomIn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(image?.style.transform).toContain("scale(1.25)");

    image?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    dialog?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 26, clientY: 31 }));
    dialog?.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    expect(image?.style.transform).toContain("translate(16px, 21px)");

    close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("[data-report-lightbox]")).toBeNull();
  });

  it("keeps native image pixels available and uses 1:1 for actual source size", () => {
    defineReadOnlyNumber(window, "innerWidth", 1280);
    defineReadOnlyNumber(window, "innerHeight", 720);
    document.body.innerHTML = '<img src="assets/hd.png" alt="HD screenshot">';

    window.eval(readFileSync(lightboxScript, "utf8"));
    document.querySelector("img")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const dialog = document.querySelector<HTMLElement>("[data-report-lightbox]");
    const preview = dialog?.querySelector<HTMLImageElement>("[data-report-lightbox-image]");
    expect(preview).toBeTruthy();

    defineReadOnlyNumber(preview!, "naturalWidth", 1920);
    defineReadOnlyNumber(preview!, "naturalHeight", 1080);
    preview?.dispatchEvent(new window.Event("load"));

    expect(preview?.style.width).toBe("1920px");
    expect(preview?.style.height).toBe("1080px");
    expect(preview?.style.transform).toContain("scale(0.");

    dialog
      ?.querySelector<HTMLElement>('[data-report-lightbox-action="reset"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(preview?.style.transform).toContain("scale(1)");
  });

  it("stores lightbox report evidence images at inspectable resolution", () => {
    const reportAssets = path.join(
      reportsRoot,
      "2026",
      "05",
      "2026-05-31-task-reports-image-lightbox",
      "assets",
    );

    expect(readImageSize(path.join(reportAssets, "01-after-desktop-lightbox.png"))).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(readImageSize(path.join(reportAssets, "02-after-mobile-lightbox.png"))).toMatchObject({
      width: 780,
      height: 1400,
    });
  });
});
