import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { makeTestDb } from "./helpers/db.js";
import { mockFetch } from "./helpers/fetch.js";
import {
  MEDIA_CACHE_LIMITS,
  cacheBookmarkMedia,
  extractBookmarkMediaCandidates,
} from "../media/bookmark-media.js";

function imageResponse(opts: {
  url: string;
  contentType?: string;
  body?: Uint8Array;
  contentLength?: string;
}): Response {
  const headers = new Headers({
    "content-type": opts.contentType ?? "image/png",
  });
  if (opts.contentLength !== undefined) {
    headers.set("content-length", opts.contentLength);
  }

  const response = new Response(opts.body ?? new Uint8Array([1, 2, 3, 4]), {
    status: 200,
    headers,
  });

  return new Proxy(response, {
    get(target, prop) {
      if (prop === "url") return opts.url;
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Response;
}

function redirectResponse(url: string, location: string): Response {
  const response = new Response(null, {
    status: 302,
    headers: { location },
  });

  return new Proxy(response, {
    get(target, prop) {
      if (prop === "url") return url;
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Response;
}

describe("bookmark media extraction", () => {
  it("extracts safe favicon, page preview, and article image candidates", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <link rel="shortcut icon" href="/favicon.ico">
          <meta property="og:image" content="/share-card.png">
        </head>
        <body>
          <article>
            <img src="/hero.png" alt="Hero diagram">
            <img src="http://127.0.0.1/private.png" alt="Private image">
            <img src="data:image/png;base64,AAA" alt="Inline image">
          </article>
        </body>
      </html>`;

    const candidates = extractBookmarkMediaCandidates("https://example.com/posts/one", html);

    expect(candidates.favicon?.sourceUrl).toBe("https://example.com/favicon.ico");
    expect(candidates.screenshot?.sourceUrl).toBe("https://example.com/share-card.png");
    expect(candidates.images).toEqual([
      {
        kind: "image",
        sourceUrl: "https://example.com/hero.png",
        alt: "Hero diagram",
      },
    ]);
  });
});

describe("bookmark media cache", () => {
  let db: Database;
  let repo: BookmarkRepository;
  let dataDir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    db = makeTestDb();
    dataDir = await mkdtemp(join(tmpdir(), "little-imp-media-"));
    repo = new BookmarkRepository(db, { dataDir });
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    db.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("caches bookmark media as local daemon paths and updates bookmark preview fields", async () => {
    const bookmark = repo.create("https://example.com/article", "Example");
    const candidates = extractBookmarkMediaCandidates(
      bookmark.url,
      `<html>
        <head>
          <link rel="icon" href="/favicon.png">
          <meta property="og:image" content="/preview.png">
        </head>
        <body>
          <article>
            <img src="/one.png" alt="One">
            <img src="/two.jpg" alt="Two">
          </article>
        </body>
      </html>`
    );

    globalThis.fetch = mockFetch(async (input) =>
      imageResponse({
        url: String(input),
        contentType: String(input).endsWith(".jpg") ? "image/jpeg" : "image/png",
      })
    );

    const media = await cacheBookmarkMedia(db, {
      bookmarkId: bookmark.id,
      dataDir,
      candidates,
    });

    expect(media.favicon?.url).toStartWith(`/media/bookmarks/${bookmark.id}/`);
    expect(media.screenshot?.url).toStartWith(`/media/bookmarks/${bookmark.id}/`);
    expect(media.images).toHaveLength(2);
    expect(media.images[0]?.alt).toBe("One");

    const updated = db
      .query<{ favicon_url: string | null; screenshot_url: string | null }, [string]>(
        "SELECT favicon_url, screenshot_url FROM bookmarks WHERE id = ?"
      )
      .get(bookmark.id)!;
    expect(updated.favicon_url).toBe(media.favicon!.url);
    expect(updated.screenshot_url).toBe(media.screenshot!.url);

    const rows = db
      .query<{ kind: string; cache_path: string; size_bytes: number }, [string]>(
        "SELECT kind, cache_path, size_bytes FROM bookmark_media WHERE bookmark_id = ? ORDER BY kind, display_order"
      )
      .all(bookmark.id);
    expect(rows.map((row) => row.kind)).toEqual(["favicon", "image", "image", "screenshot"]);
    expect(rows.every((row) => row.size_bytes > 0)).toBe(true);
    for (const row of rows) {
      expect(existsSync(join(dataDir, row.cache_path))).toBe(true);
    }
  });

  it("skips private-host media without fetching and skips oversized image responses", async () => {
    const bookmark = repo.create("https://example.com/article", "Example");
    let calls = 0;

    globalThis.fetch = mockFetch(async (input) => {
      calls += 1;
      return imageResponse({
        url: String(input),
        contentLength: String(MEDIA_CACHE_LIMITS.maxImageBytes + 1),
      });
    });

    const media = await cacheBookmarkMedia(db, {
      bookmarkId: bookmark.id,
      dataDir,
      candidates: {
        favicon: { kind: "favicon", sourceUrl: "http://127.0.0.1/favicon.ico" },
        screenshot: null,
        images: [{ kind: "image", sourceUrl: "https://example.com/huge.png", alt: null }],
      },
    });

    expect(calls).toBe(1);
    expect(media.favicon).toBeNull();
    expect(media.images).toEqual([]);
    const count = db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM bookmark_media WHERE bookmark_id = ?"
      )
      .get(bookmark.id)?.count;
    expect(count).toBe(0);
  });

  it("does not follow media redirects to private hosts", async () => {
    const bookmark = repo.create("https://example.com/article", "Example");
    let attemptedPrivateFetch = false;

    globalThis.fetch = mockFetch(async (input, init) => {
      if (String(input) === "https://example.com/redirect.png") {
        if (init?.redirect === "manual") {
          return redirectResponse(String(input), "http://127.0.0.1/private.png");
        }
        attemptedPrivateFetch = true;
        return imageResponse({
          url: "http://127.0.0.1/private.png",
          contentType: "image/png",
        });
      }

      attemptedPrivateFetch = true;
      return imageResponse({ url: String(input), contentType: "image/png" });
    });

    const media = await cacheBookmarkMedia(db, {
      bookmarkId: bookmark.id,
      dataDir,
      candidates: {
        favicon: null,
        screenshot: { kind: "screenshot", sourceUrl: "https://example.com/redirect.png" },
        images: [],
      },
    });

    expect(attemptedPrivateFetch).toBe(false);
    expect(media.screenshot).toBeNull();
  });

  it("does not cache remote SVG media under the daemon origin", async () => {
    const bookmark = repo.create("https://example.com/article", "Example");

    globalThis.fetch = mockFetch(async (input) =>
      imageResponse({
        url: String(input),
        contentType: "image/svg+xml",
        body: new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
      })
    );

    const media = await cacheBookmarkMedia(db, {
      bookmarkId: bookmark.id,
      dataDir,
      candidates: {
        favicon: { kind: "favicon", sourceUrl: "https://example.com/icon.svg" },
        screenshot: null,
        images: [],
      },
    });

    expect(media.favicon).toBeNull();
    const count = db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM bookmark_media WHERE bookmark_id = ?"
      )
      .get(bookmark.id)?.count;
    expect(count).toBe(0);
  });

  it("deduplicates media candidates that resolve to the same final URL", async () => {
    const bookmark = repo.create("https://example.com/article", "Example");

    globalThis.fetch = mockFetch(async () =>
      imageResponse({
        url: "https://cdn.example.com/shared-preview.png",
        contentType: "image/png",
      })
    );

    const media = await cacheBookmarkMedia(db, {
      bookmarkId: bookmark.id,
      dataDir,
      candidates: {
        favicon: null,
        screenshot: null,
        images: [
          { kind: "image", sourceUrl: "https://example.com/image-a.png", alt: "A" },
          { kind: "image", sourceUrl: "https://example.com/image-b.png", alt: "B" },
        ],
      },
    });

    expect(media.images).toHaveLength(1);
    expect(media.images[0]?.source_url).toBe("https://cdn.example.com/shared-preview.png");
  });

  it("permanent delete removes cached media files", async () => {
    const bookmark = repo.create("https://example.com/article", "Example");
    globalThis.fetch = mockFetch(async (input) => imageResponse({ url: String(input) }));

    const media = await cacheBookmarkMedia(db, {
      bookmarkId: bookmark.id,
      dataDir,
      candidates: {
        favicon: { kind: "favicon", sourceUrl: "https://example.com/favicon.png" },
        screenshot: null,
        images: [],
      },
    });
    const row = db
      .query<{ cache_path: string }, [string]>(
        "SELECT cache_path FROM bookmark_media WHERE bookmark_id = ?"
      )
      .get(bookmark.id)!;
    const cachedPath = join(dataDir, row.cache_path);
    await expect(stat(cachedPath)).resolves.toBeDefined();
    expect(media.favicon).not.toBeNull();

    repo.softDelete(bookmark.id);
    expect(repo.permanentDelete(bookmark.id)).toBe(true);

    expect(existsSync(cachedPath)).toBe(false);
    const remaining = db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM bookmark_media WHERE bookmark_id = ?"
      )
      .get(bookmark.id)?.count;
    expect(remaining).toBe(0);
  });
});
