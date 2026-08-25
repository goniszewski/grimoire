import { describe, expect, it } from "bun:test";
import { combineFtsSummary } from "../lib/fts-summary.js";

describe("combineFtsSummary", () => {
  it("falls back to description when summary is blank", () => {
    expect(combineFtsSummary("Migrated desc", null)).toBe("Migrated desc");
    expect(combineFtsSummary("Migrated desc", "  ")).toBe("Migrated desc");
  });

  it("falls back to summary when description is blank", () => {
    expect(combineFtsSummary(null, "LLM summary")).toBe("LLM summary");
  });

  it("concatenates distinct description and summary", () => {
    expect(combineFtsSummary("legacy token", "llm token")).toBe("legacy token llm token");
  });

  it("does not duplicate when one contains the other", () => {
    expect(combineFtsSummary("short", "short and longer")).toBe("short and longer");
    expect(combineFtsSummary("longer phrase here", "longer")).toBe("longer phrase here");
  });
});
