import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { getBookmarkMediaFile } from "../media/bookmark-media.js";

interface MediaDeps {
  db: Database;
  dataDir: string;
}

export function createMediaRoute(deps: MediaDeps): Hono {
  const router = new Hono();

  router.get("/media/bookmarks/:bookmarkId/:mediaId", (c) => {
    const media = getBookmarkMediaFile(
      deps.db,
      deps.dataDir,
      c.req.param("bookmarkId"),
      c.req.param("mediaId")
    );

    if (!media) {
      return c.json(
        {
          type: "https://littleimp.app/problems/not-found",
          title: "Not Found",
          status: 404,
          detail: "Media not found",
        },
        404,
        { "Content-Type": "application/problem+json" }
      );
    }

    return new Response(Bun.file(media.path), {
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(media.sizeBytes),
        "Content-Type": media.mediaType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  return router;
}
