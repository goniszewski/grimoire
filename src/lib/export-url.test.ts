import { describe, expect, it } from "vitest";
import { buildExportUrl } from "./export-url";

describe("buildExportUrl", () => {
  it("includes read-later filters in export URLs", () => {
    const url = new URL(buildExportUrl("json", { read_later: true }));

    expect(url.pathname).toBe("/export");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("read_later")).toBe("true");
  });

  it("preserves explicit false read-later filters in export URLs", () => {
    const url = new URL(buildExportUrl("csv", { read_later: false }));

    expect(url.searchParams.get("format")).toBe("csv");
    expect(url.searchParams.get("read_later")).toBe("false");
  });
});
