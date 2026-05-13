/**
 * Unit tests for the fetch stage (pipeline/fetcher.ts).
 *
 * All external HTTP calls are intercepted by patching globalThis.fetch.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { fetchPage } from "../../pipeline/fetcher.js";
import { mockFetch } from "../helpers/fetch.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Response-like object that fetch would return. */
function makeResponse(
  opts: {
    status?: number;
    statusText?: string;
    url?: string;
    contentType?: string;
    body?: string;
    bytes?: Uint8Array;
    contentLength?: string;
  } = {}
): Response {
  const {
    status = 200,
    statusText = "OK",
    url = "https://example.com/page",
    contentType = "text/html; charset=utf-8",
    body = "<html><body>Hello</body></html>",
    bytes,
    contentLength,
  } = opts;

  const headers = new Headers({ "content-type": contentType });
  if (contentLength !== undefined) headers.set("content-length", contentLength);

  const rawBody = bytes ?? new TextEncoder().encode(body);

  // Build a ReadableStream that yields the body bytes and then closes.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(rawBody);
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    statusText,
    headers,
  }) as Response & { readonly url: string };
}

/** Wrap a Response to override the read-only `url` property. */
function withUrl(res: Response, url: string): Response {
  return new Proxy(res, {
    get(target, prop) {
      if (prop === "url") return url;
      const val = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fetchPage", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("returns html body and finalUrl for a valid URL", async () => {
    const html = "<html><body>Hello World</body></html>";
    globalThis.fetch = mockFetch(async () =>
      withUrl(makeResponse({ body: html }), "https://example.com/page")
    );

    const result = await fetchPage("https://example.com/page");

    expect(result.html).toBe(html);
    expect(result.finalUrl).toBe("https://example.com/page");
    expect(result.contentType).toContain("text/html");
  });

  // ── Non-200 response ────────────────────────────────────────────────────

  it("throws on HTTP 404 response", async () => {
    globalThis.fetch = mockFetch(async () =>
      withUrl(makeResponse({ status: 404, statusText: "Not Found" }), "https://example.com/missing")
    );

    await expect(fetchPage("https://example.com/missing")).rejects.toThrow("HTTP 404");
  });

  it("throws on HTTP 500 response", async () => {
    globalThis.fetch = mockFetch(async () =>
      withUrl(makeResponse({ status: 500, statusText: "Internal Server Error" }), "https://example.com/err")
    );

    await expect(fetchPage("https://example.com/err")).rejects.toThrow("HTTP 500");
  });

  // ── Network timeout ─────────────────────────────────────────────────────

  it("throws when fetch aborts due to timeout signal", async () => {
    // Simulate a fetch that respects the AbortSignal and rejects when it fires.
    // fetchPage passes an AbortController signal tied to a 20 s timer; we
    // immediately abort via the signal to avoid waiting 20 s in tests.
    globalThis.fetch = mockFetch(async (_url, opts) => {
      const signal = opts?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
        if (signal?.aborted) {
          abort();
          return;
        }
        signal?.addEventListener("abort", abort);
        // Trigger abort on next microtask to let fetchPage attach its listener first
        Promise.resolve().then(abort);
      });
    });

    await expect(fetchPage("https://example.com/slow")).rejects.toThrow(/aborted/i);
  });

  // ── Redirects ───────────────────────────────────────────────────────────

  it("follows redirects and returns the final URL", async () => {
    const html = "<html><body>Redirected</body></html>";
    // fetch follows redirects automatically; the finalUrl on the Response
    // reflects the ultimate destination.
    globalThis.fetch = mockFetch(async () =>
      withUrl(makeResponse({ body: html }), "https://example.com/final")
    );

    const result = await fetchPage("https://example.com/original");

    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.html).toBe(html);
  });

  // ── Private-host guard ──────────────────────────────────────────────────

  it("throws for loopback URLs without making a network call", async () => {
    let called = false;
    globalThis.fetch = mockFetch(async () => {
      called = true;
      return makeResponse();
    });

    await expect(fetchPage("http://localhost/evil")).rejects.toThrow(/private host/i);
    expect(called).toBe(false);
  });

  it("throws for RFC-1918 private addresses", async () => {
    await expect(fetchPage("http://192.168.1.1/evil")).rejects.toThrow(/private host/i);
    await expect(fetchPage("http://10.0.0.1/evil")).rejects.toThrow(/private host/i);
  });

  // ── Oversized response ──────────────────────────────────────────────────

  it("throws when Content-Length exceeds 10 MB", async () => {
    globalThis.fetch = mockFetch(async () =>
      withUrl(
        makeResponse({ contentLength: String(11 * 1024 * 1024) }),
        "https://example.com/big"
      )
    );

    await expect(fetchPage("https://example.com/big")).rejects.toThrow(/too large/i);
  });

  // ── Unexpected content-type ─────────────────────────────────────────────

  it("throws for non-HTML, non-PDF content types", async () => {
    globalThis.fetch = mockFetch(async () =>
      withUrl(makeResponse({ contentType: "application/json" }), "https://example.com/api")
    );

    await expect(fetchPage("https://example.com/api")).rejects.toThrow(/content-type/i);
  });

  // ── PDF ─────────────────────────────────────────────────────────────────

  it("returns bytes for PDF content type", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    globalThis.fetch = mockFetch(async () =>
      withUrl(
        makeResponse({ contentType: "application/pdf", bytes: pdfBytes }),
        "https://example.com/doc.pdf"
      )
    );

    const result = await fetchPage("https://example.com/doc.pdf");
    expect(result.bytes).toBeDefined();
    expect(result.html).toBe("");
  });
});
