/**
 * Unit tests for the extract stage (pipeline/extractor.ts + extractors/readability.ts).
 *
 * No network calls are made — all extraction is performed on static HTML fixtures.
 */

import { describe, it, expect } from "bun:test";
import { extractContent } from "../../pipeline/extractor.js";
import { extractWithReadability } from "../../pipeline/extractors/readability.js";
import type { FetchResult } from "../../pipeline/fetcher.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Article Title</title>
  <meta name="description" content="A short description.">
  <meta property="og:title" content="OG Article Title">
  <meta name="author" content="Jane Doe">
  <meta property="article:published_time" content="2024-01-15T10:00:00Z">
</head>
<body>
  <header><nav>Navigation stuff</nav></header>
  <main>
    <article>
      <h1>Main Heading</h1>
      <p>This is the first paragraph of the article content.</p>
      <p>Here is a second paragraph with more detail.</p>
    </article>
  </main>
  <footer>Footer content</footer>
</body>
</html>`;

const MINIMAL_HTML = `<html><body><p>Just some text here.</p></body></html>`;

const MALFORMED_HTML = `<html><body><p>Unclosed paragraph<div>Mixed tags</p></div><p>More text</body>`;

function makeFetch(html: string, url = "https://example.com/"): FetchResult {
  return { html, finalUrl: url, contentType: "text/html" };
}

// ─── extractWithReadability ────────────────────────────────────────────────────

describe("extractWithReadability", () => {
  it("extracts title from og:title meta tag", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    expect(result.title).toBe("OG Article Title");
  });

  it("falls back to <title> when og:title absent", () => {
    const html = `<html><head><title>Fallback Title</title></head><body><p>Content</p></body></html>`;
    const result = extractWithReadability(html, html);
    expect(result.title).toBe("Fallback Title");
  });

  it("returns null title when neither og:title nor <title> present", () => {
    const result = extractWithReadability(MINIMAL_HTML, MINIMAL_HTML);
    expect(result.title).toBeNull();
  });

  it("extracts author from meta tags", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    expect(result.author).toBe("Jane Doe");
  });

  it("extracts publishedAt from article:published_time", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    expect(result.publishedAt).toBe("2024-01-15T10:00:00Z");
  });

  it("extracts main article content and converts to markdown", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    expect(result.markdown).not.toBeNull();
    expect(result.markdown).toContain("Main Heading");
    expect(result.markdown).toContain("first paragraph");
  });

  it("includes word count", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("detects language from lang attribute", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    expect(result.language).toBe("en");
  });

  it("handles HTML with no description gracefully", () => {
    const html = `<html><head><title>T</title></head><body><p>Hello</p></body></html>`;
    const result = extractWithReadability(html, html);
    expect(result.title).toBe("T");
    expect(result.markdown).not.toBeNull();
  });

  it("does not throw on malformed HTML", () => {
    expect(() => extractWithReadability(MALFORMED_HTML, MALFORMED_HTML)).not.toThrow();
  });

  it("returns some content even for malformed HTML", () => {
    const result = extractWithReadability(MALFORMED_HTML, MALFORMED_HTML);
    expect(result.markdown).not.toBeNull();
    expect((result.markdown ?? "").length).toBeGreaterThan(0);
  });

  it("strips nav/header/footer boilerplate from output", () => {
    const result = extractWithReadability(FULL_HTML, FULL_HTML);
    // Navigation and footer text should not appear in extracted markdown
    expect(result.markdown).not.toContain("Navigation stuff");
    expect(result.markdown).not.toContain("Footer content");
  });
});

// ─── extractContent (strategy routing) ────────────────────────────────────────

describe("extractContent", () => {
  it("uses readability for a generic URL", async () => {
    const result = await extractContent(
      "https://example.com/article",
      makeFetch(FULL_HTML),
      null
    );
    expect(result.title).not.toBeNull();
    expect(result.markdown).not.toBeNull();
  });

  it("falls back gracefully when html is empty string", async () => {
    const result = await extractContent(
      "https://example.com/empty",
      makeFetch(""),
      "Fallback Title"
    );
    // Should not throw; result must be a valid ExtractionResult object
    expect(result).toBeDefined();
    expect(typeof result.wordCount).toBe("number");
  });

  it("extracts content without fallback title", async () => {
    const result = await extractContent(
      "https://example.com/",
      makeFetch(MINIMAL_HTML),
      null
    );
    expect(result.markdown).not.toBeNull();
    // MINIMAL_HTML has body text — word count must be non-zero
    expect(result.wordCount).toBeGreaterThan(0);
  });
});
