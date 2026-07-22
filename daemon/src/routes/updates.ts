import { Hono, type Context } from "hono";
import {
  UpdateCheckError,
  checkForUpdates,
  parseUpdateChannel,
} from "../update/service.js";

function problem(
  c: Context,
  status: 422 | 502,
  title: string,
  detail?: string
) {
  return c.json(
    {
      type: `https://littleimp.app/problems/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status,
      detail,
    },
    status,
    { "Content-Type": "application/problem+json" }
  );
}

export function createUpdatesRoute(): Hono {
  const router = new Hono();

  router.get("/updates/check", async (c) => {
    let channel;
    try {
      channel = parseUpdateChannel(c.req.query("channel"));
    } catch (err) {
      if (err instanceof UpdateCheckError && err.status === 422) {
        return problem(c, 422, "Unprocessable Entity", err.message);
      }
      throw err;
    }

    // HTTP update checks always use the default / env-configured source.
    // Arbitrary `source` query params are rejected to prevent SSRF via GET
    // (which is not covered by Origin enforcement for unsafe methods).
    if (c.req.query("source") != null && c.req.query("source") !== "") {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        "The source query parameter is not accepted on the HTTP update check. Configure LITTLEIMP_UPDATE_SOURCE or use the CLI."
      );
    }

    try {
      const result = await checkForUpdates({ channel });
      return c.json({ data: result });
    } catch (err) {
      if (err instanceof UpdateCheckError) {
        const status = err.status === 422 ? 422 : 502;
        const title = status === 422 ? "Unprocessable Entity" : "Bad Gateway";
        return problem(c, status, title, err.message);
      }
      throw err;
    }
  });

  return router;
}
