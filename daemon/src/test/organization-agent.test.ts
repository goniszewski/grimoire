import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { EmbeddingRepository } from "../db/embedding-repository.js";
import { makeTestDb } from "./helpers/db.js";
import type { Settings } from "../settings.js";

describe("OrganizationAgent", () => {
  let originalXdgConfigHome: string | undefined;
  let tempConfigHome: string;

  beforeEach(async () => {
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    tempConfigHome = await mkdtemp(join(tmpdir(), "little-imp-agent-settings-"));
    process.env.XDG_CONFIG_HOME = tempConfigHome;
  });

  afterEach(async () => {
    const { settingsManager } = await import("../settings.js");
    (settingsManager as unknown as { cache: unknown }).cache = null;
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    await rm(tempConfigHome, { recursive: true, force: true });
  });

  it("uses sqlite-vec duplicate detection beyond the old 2,000 embedding cap when available", async () => {
    const { settingsManager } = await import("../settings.js");
    const { OrganizationAgent } = await import("../ai/organization-agent.js");
    settingsManager.write({
      ai: {
        embeddings: {
          provider: "ollama",
          model: "test-model",
        },
      },
    } as Partial<Settings>);

    const db = makeTestDb();
    const bookmarks = new BookmarkRepository(db);
    const embeddings = new EmbeddingRepository(db);
    const vectorIndexAvailable = embeddings.isVectorIndexAvailable(64);
    if (!vectorIndexAvailable) {
      expect(vectorIndexAvailable).toBe(false);
      return;
    }

    const duplicateA = bookmarks.create("https://duplicates.example.com/a", "Duplicate A");
    const duplicateB = bookmarks.create("https://duplicates.example.com/b", "Duplicate B");
    embeddings.upsert(duplicateA.id, "test-model", duplicateVector());
    embeddings.upsert(duplicateB.id, "test-model", nearDuplicateVector());

    for (let index = 0; index < 1_999; index += 1) {
      const bookmark = bookmarks.create(
        `https://filler-${index}.example.com/resource`,
        `Filler ${index}`
      );
      embeddings.upsert(bookmark.id, "test-model", fillerVector(index));
    }

    await new OrganizationAgent(db).run();

    const duplicateRows = db
      .query<{ id: string; is_trashed: 0 | 1 }, [string, string]>(
        "SELECT id, is_trashed FROM bookmarks WHERE id IN (?, ?) ORDER BY id"
      )
      .all(duplicateA.id, duplicateB.id);
    expect(duplicateRows.some((row) => row.is_trashed === 1)).toBe(true);
  });
});

function duplicateVector(): number[] {
  return [1, ...new Array<number>(63).fill(0)];
}

function nearDuplicateVector(): number[] {
  return [0.9999, 0.0001, ...new Array<number>(62).fill(0)];
}

function fillerVector(index: number): number[] {
  let seed = (index + 1) * 2_654_435_761;
  const vector = [0, 0];

  for (let dim = 2; dim < 64; dim += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    vector.push((seed / 0xffffffff) * 2 - 1);
  }

  const magnitude = Math.hypot(...vector);
  return vector.map((value) => value / magnitude);
}
