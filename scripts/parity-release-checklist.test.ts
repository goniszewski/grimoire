import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseChecklist = readFileSync("docs/release-checklist.md", "utf8");
const paritySectionStart = releaseChecklist.indexOf("## Recurring Grimoire Parity Review");
const paritySectionEnd = releaseChecklist.indexOf("\n## ", paritySectionStart + 1);
const paritySection =
  paritySectionStart >= 0
    ? releaseChecklist.slice(
        paritySectionStart,
        paritySectionEnd >= 0 ? paritySectionEnd : releaseChecklist.length,
      )
    : "";

const parityCheckpoints = [
  "API contract and docs",
  "Bookmark model and detail fields",
  "Category and tag management",
  "Import and export behavior",
  "Search, filters, pagination, and aggregates",
  "Local integration behavior",
];

const verificationSignals = [
  "API docs drift",
  "focused daemon tests",
  "focused frontend tests",
  "visual verification",
  "e2e",
  "Playwright",
  "performance",
];

describe("parity release checklist", () => {
  it("keeps a recurring Grimoire parity review in release planning", () => {
    expect(paritySection).toContain("## Recurring Grimoire Parity Review");
    expect(paritySection).toContain("docs/parity/grimoire-feature-parity-report.md");
    expect(paritySection).toContain("docs/parity/grimoire-parity-task-proposals.md");

    for (const checkpoint of parityCheckpoints) {
      expect(paritySection).toContain(checkpoint);
    }
  });

  it("names verification signals for parity regression areas", () => {
    for (const signal of verificationSignals) {
      expect(paritySection.toLowerCase()).toContain(signal.toLowerCase());
    }
  });
});
