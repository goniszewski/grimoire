/**
 * Development seed script.
 * Usage:  bun run src/db/seed/dev-seed.ts
 *
 * Inserts representative sample data so you can develop/test against
 * a realistic database without hitting live URLs.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { Config } from "../../config.js";
import { runMigrations } from "../migrations.js";

const dbPath = join(Config.DATA_DIR, "littleimp.db");
mkdirSync(Config.DATA_DIR, { recursive: true });

const db = new Database(dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
runMigrations(db);

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Generate a 32-char lowercase hex ID — same format as schema DEFAULT lower(hex(randomblob(16))). */
function id(): string {
  return randomBytes(16).toString("hex");
}

function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}

// ─── Wipe existing seed data ─────────────────────────────────────────────────

db.exec("DELETE FROM timeline_events");
db.exec("DELETE FROM agent_suggestions");
db.exec("DELETE FROM embeddings");
db.exec("DELETE FROM bookmark_tags");
db.exec("DELETE FROM bookmark_content");
db.exec("DELETE FROM bookmarks");
db.exec("DELETE FROM tags");
db.exec("DELETE FROM categories");
db.exec("DELETE FROM jobs");

// ─── Categories ──────────────────────────────────────────────────────────────

const categories = [
  { id: id(), name: "Engineering", parent_id: null },
  { id: id(), name: "Design",      parent_id: null },
  { id: id(), name: "Research",    parent_id: null },
] as const;

const [catEng, catDesign, catResearch] = categories;

const subCategories = [
  { id: id(), name: "Frontend",  parent_id: catEng.id },
  { id: id(), name: "Backend",   parent_id: catEng.id },
  { id: id(), name: "Databases", parent_id: catEng.id },
];
const [catFE, catBE, catDB] = subCategories;

const insertCat = db.prepare(
  "INSERT INTO categories(id,name,parent_id) VALUES (?,?,?)"
);
for (const c of [...categories, ...subCategories]) {
  insertCat.run(c.id, c.name, c.parent_id ?? null);
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

const tagNames = [
  "typescript", "bun", "sqlite", "react", "hono",
  "ai", "llm", "vector-search", "performance", "ux",
];
const tagIds: Record<string, string> = {};
const insertTag = db.prepare("INSERT INTO tags(id,name) VALUES (?,?)");
for (const name of tagNames) {
  const tid = id();
  tagIds[name] = tid;
  insertTag.run(tid, name);
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

interface SeedBookmark {
  id: string;
  url: string;
  domain: string;
  title: string;
  description: string;
  status: string;
  category_id: string;
  created_at: string;
  tags: string[];
  content?: { markdown: string; summary: string; word_count: number };
}

const bookmarks: SeedBookmark[] = [
  {
    id: id(),
    url: "https://bun.sh/docs",
    domain: "bun.sh",
    title: "Bun Documentation",
    description: "Official documentation for the Bun JavaScript runtime.",
    status: "ai_enriched",
    category_id: catBE.id,
    created_at: daysAgo(30),
    tags: ["bun", "typescript", "performance"],
    content: {
      markdown: "# Bun\nBun is a fast all-in-one JavaScript runtime...",
      summary: "Official docs covering the Bun runtime, package manager, and bundler.",
      word_count: 1200,
    },
  },
  {
    id: id(),
    url: "https://hono.dev/docs/getting-started/basic",
    domain: "hono.dev",
    title: "Hono – Getting Started",
    description: "Fast, lightweight web framework for the edge.",
    status: "extracted",
    category_id: catBE.id,
    created_at: daysAgo(25),
    tags: ["hono", "typescript"],
    content: {
      markdown: "# Getting Started\nHono is a small, simple web framework...",
      summary: "Introduction to Hono: routing, middleware, and context.",
      word_count: 850,
    },
  },
  {
    id: id(),
    url: "https://www.sqlite.org/fts5.html",
    domain: "sqlite.org",
    title: "SQLite FTS5 Extension",
    description: "Full-text search extension for SQLite databases.",
    status: "indexed",
    category_id: catDB.id,
    created_at: daysAgo(20),
    tags: ["sqlite", "performance"],
    content: {
      markdown: "# FTS5\nFTS5 is an SQLite virtual table module...",
      summary: "Explains FTS5 tokenizers, auxiliary functions, and contentless tables.",
      word_count: 3100,
    },
  },
  {
    id: id(),
    url: "https://react.dev/learn",
    domain: "react.dev",
    title: "Learn React",
    description: "Interactive tutorial for learning React.",
    status: "fetched",
    category_id: catFE.id,
    created_at: daysAgo(15),
    tags: ["react", "typescript"],
  },
  {
    id: id(),
    url: "https://example.com/ux-principles",
    domain: "example.com",
    title: "UX Principles for Developer Tools",
    description: "How to design developer-facing UIs.",
    status: "saved",
    category_id: catDesign.id,
    created_at: daysAgo(5),
    tags: ["ux"],
  },
  {
    id: id(),
    url: "https://arxiv.org/abs/2310.06825",
    domain: "arxiv.org",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    description: "RAG paper combining retrieval with generation.",
    status: "ai_enriched",
    category_id: catResearch.id,
    created_at: daysAgo(10),
    tags: ["ai", "llm", "vector-search"],
    content: {
      markdown: "# RAG\nWe explore a general-purpose fine-tuning recipe...",
      summary: "Introduces Retrieval-Augmented Generation for open-domain QA.",
      word_count: 4500,
    },
  },
];

const insertBM = db.prepare(`
  INSERT INTO bookmarks(id,url,domain,title,description,status,category_id,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?)
`);
const insertContent = db.prepare(`
  INSERT INTO bookmark_content(bookmark_id,markdown,summary,word_count)
  VALUES (?,?,?,?)
`);
const insertBMTag = db.prepare(
  "INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES (?,?)"
);

for (const bm of bookmarks) {
  insertBM.run(
    bm.id, bm.url, bm.domain, bm.title, bm.description,
    bm.status, bm.category_id, bm.created_at, now()
  );

  if (bm.content) {
    insertContent.run(
      bm.id, bm.content.markdown, bm.content.summary, bm.content.word_count
    );
  }

  for (const tag of bm.tags) {
    if (tagIds[tag]) insertBMTag.run(bm.id, tagIds[tag]);
  }
}

// ─── Agent suggestions ───────────────────────────────────────────────────────

const insertSuggestion = db.prepare(`
  INSERT INTO agent_suggestions(id,bookmark_id,type,value,confidence,status)
  VALUES (?,?,?,?,?,?)
`);
insertSuggestion.run(
  id(), bookmarks[3].id, "category", catFE.id, 0.92, "pending"
);
insertSuggestion.run(
  id(), bookmarks[4].id, "tag", tagIds["ux"], 0.87, "accepted"
);

// ─── Timeline events ─────────────────────────────────────────────────────────

const insertEvent = db.prepare(`
  INSERT INTO timeline_events(id,bookmark_id,event_type,payload,created_at)
  VALUES (?,?,?,?,?)
`);
for (const bm of bookmarks) {
  insertEvent.run(
    id(), bm.id, "created",
    JSON.stringify({ url: bm.url }),
    bm.created_at
  );
}
insertEvent.run(
  id(), bookmarks[0].id, "status_changed",
  JSON.stringify({ from: "saved", to: "ai_enriched" }),
  now()
);

// ─── Jobs ─────────────────────────────────────────────────────────────────────

const insertJob = db.prepare(`
  INSERT INTO jobs(id,type,status,payload,created_at)
  VALUES (?,?,?,?,?)
`);
insertJob.run(
  id(), "fetch_content", "pending",
  JSON.stringify({ bookmark_id: bookmarks[3].id }),
  now()
);
insertJob.run(
  id(), "llm_enrich", "done",
  JSON.stringify({ bookmark_id: bookmarks[0].id }),
  daysAgo(29)
);

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`✓ Seed complete — ${bookmarks.length} bookmarks, ${tagNames.length} tags`);
db.close();
