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

  it("includes category IDs in export URLs", () => {
    const url = new URL(buildExportUrl("json", { category: "Notes", category_id: "cat-two" }));

    expect(url.searchParams.get("category")).toBe("Notes");
    expect(url.searchParams.get("category_id")).toBe("cat-two");
  });

  it("includes parity filters in export URLs", () => {
    const url = new URL(buildExportUrl("json", {
      read_state: "read",
      is_pinned: false,
      opened_count_min: 2,
      opened_count_max: 5,
      last_opened_from: "2026-06-01",
      last_opened_to: "2026-06-02",
    }));

    expect(url.searchParams.get("read_state")).toBe("read");
    expect(url.searchParams.get("is_pinned")).toBe("false");
    expect(url.searchParams.get("opened_count_min")).toBe("2");
    expect(url.searchParams.get("opened_count_max")).toBe("5");
    expect(url.searchParams.get("last_opened_from")).toBe("2026-06-01");
    expect(url.searchParams.get("last_opened_to")).toBe("2026-06-02");
  });
});
