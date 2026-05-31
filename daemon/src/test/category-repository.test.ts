import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { CategoryRepository } from "../db/category-repository.js";
import { makeTestDb } from "./helpers/db.js";

describe("CategoryRepository", () => {
  let db: Database;
  let repo: CategoryRepository;

  beforeEach(() => {
    db = makeTestDb();
    repo = new CategoryRepository(db);
  });

  // ─── Create ──────────────────────────────────────────────────────────────

  it("creates a root category (no parent)", () => {
    const cat = repo.create("Development");
    expect(cat.name).toBe("Development");
    expect(cat.parent_id).toBeNull();
    expect(cat.id).toBeString();
  });

  it("creates category metadata and returns it from the tree", () => {
    const cat = repo.create("AI Research", null, {
      color: "#2563eb",
      icon: "brain",
      description: "Machine learning papers and agent notes",
      slug: "ai-research",
      is_archived: 1,
      is_public: 1,
    });

    expect(cat.color).toBe("#2563eb");
    expect(cat.icon).toBe("brain");
    expect(cat.description).toBe("Machine learning papers and agent notes");
    expect(cat.slug).toBe("ai-research");
    expect(cat.is_archived).toBe(1);
    expect(cat.is_public).toBe(1);

    const tree = repo.listTree();
    expect(tree[0]).toMatchObject({
      id: cat.id,
      color: "#2563eb",
      icon: "brain",
      description: "Machine learning papers and agent notes",
      slug: "ai-research",
      is_archived: 1,
      is_public: 1,
    });
  });

  it("trims whitespace from category name", () => {
    const cat = repo.create("  Dev  ");
    expect(cat.name).toBe("Dev");
  });

  it("creates a child category (depth 1)", () => {
    const root = repo.create("Root");
    const child = repo.create("Child", root.id);
    expect(child.parent_id).toBe(root.id);
  });

  it("creates a grandchild category (depth 2)", () => {
    const root = repo.create("Root");
    const child = repo.create("Child", root.id);
    const grand = repo.create("Grandchild", child.id);
    expect(grand.parent_id).toBe(child.id);
    expect(repo.depth(grand.id)).toBe(2);
  });

  // ─── depth ───────────────────────────────────────────────────────────────

  it("depth of root is 0", () => {
    const cat = repo.create("Root");
    expect(repo.depth(cat.id)).toBe(0);
  });

  it("depth of child is 1", () => {
    const root = repo.create("Root");
    const child = repo.create("Child", root.id);
    expect(repo.depth(child.id)).toBe(1);
  });

  it("depth of grandchild is 2", () => {
    const root = repo.create("Root");
    const child = repo.create("Child", root.id);
    const grand = repo.create("Grand", child.id);
    expect(repo.depth(grand.id)).toBe(2);
  });

  // ─── findById ────────────────────────────────────────────────────────────

  it("findById returns the category", () => {
    const cat = repo.create("Test");
    expect(repo.findById(cat.id)).not.toBeNull();
    expect(repo.findById(cat.id)!.name).toBe("Test");
  });

  it("findById returns null for unknown id", () => {
    expect(repo.findById("nonexistent")).toBeNull();
  });

  // ─── findByName ──────────────────────────────────────────────────────────

  it("findByName is case-insensitive", () => {
    repo.create("JavaScript");
    expect(repo.findByName("javascript")).not.toBeNull();
    expect(repo.findByName("JAVASCRIPT")).not.toBeNull();
    expect(repo.findByName("JavaScript")).not.toBeNull();
  });

  it("findByName returns null for unknown name", () => {
    expect(repo.findByName("Nope")).toBeNull();
  });

  // ─── Rename (update name) ─────────────────────────────────────────────────

  it("renames a category", () => {
    const cat = repo.create("Old Name");
    const updated = repo.update(cat.id, { name: "New Name" });
    expect(updated!.name).toBe("New Name");
  });

  it("updates and clears category metadata", () => {
    const cat = repo.create("Reference", null, {
      color: "#0f766e",
      icon: "book-open",
      description: "Reference material",
      slug: "reference",
      is_archived: 0,
      is_public: 0,
    });

    const updated = repo.update(cat.id, {
      color: null,
      icon: null,
      description: "Updated reference material",
      slug: "reference-updated",
      is_archived: 1,
      is_public: 1,
    });

    expect(updated).toMatchObject({
      color: null,
      icon: null,
      description: "Updated reference material",
      slug: "reference-updated",
      is_archived: 1,
      is_public: 1,
    });
  });

  it("update with no fields returns the current category unchanged", () => {
    const cat = repo.create("Stable");
    const result = repo.update(cat.id, {});
    expect(result!.name).toBe("Stable");
  });

  it("update returns null for unknown id", () => {
    const result = repo.update("nonexistent", { name: "X" });
    expect(result).toBeNull();
  });

  // ─── Reparent (update parent_id) ──────────────────────────────────────────

  it("reparents a category to a new parent", () => {
    const a = repo.create("A");
    const b = repo.create("B");
    const child = repo.create("Child", a.id);
    repo.update(child.id, { parent_id: b.id });
    expect(repo.findById(child.id)!.parent_id).toBe(b.id);
  });

  it("can move a category to root (parent_id = null)", () => {
    const root = repo.create("Root");
    const child = repo.create("Child", root.id);
    repo.update(child.id, { parent_id: null });
    expect(repo.findById(child.id)!.parent_id).toBeNull();
  });

  // ─── isAncestorOrSelf ─────────────────────────────────────────────────────

  it("isAncestorOrSelf returns true for self", () => {
    const cat = repo.create("Self");
    expect(repo.isAncestorOrSelf(cat.id, cat.id)).toBe(true);
  });

  it("isAncestorOrSelf returns true for direct parent", () => {
    const parent = repo.create("Parent");
    const child = repo.create("Child", parent.id);
    expect(repo.isAncestorOrSelf(parent.id, child.id)).toBe(true);
  });

  it("isAncestorOrSelf returns true for grandparent", () => {
    const root = repo.create("Root");
    const mid = repo.create("Mid", root.id);
    const leaf = repo.create("Leaf", mid.id);
    expect(repo.isAncestorOrSelf(root.id, leaf.id)).toBe(true);
  });

  it("isAncestorOrSelf returns false for unrelated category", () => {
    const a = repo.create("A");
    const b = repo.create("B");
    expect(repo.isAncestorOrSelf(a.id, b.id)).toBe(false);
  });

  it("isAncestorOrSelf returns false when child is checked against parent direction", () => {
    const parent = repo.create("Parent");
    const child = repo.create("Child", parent.id);
    expect(repo.isAncestorOrSelf(child.id, parent.id)).toBe(false);
  });

  // ─── Delete ───────────────────────────────────────────────────────────────

  it("delete returns true for existing category", () => {
    const cat = repo.create("ToDelete");
    expect(repo.delete(cat.id)).toBe(true);
    expect(repo.findById(cat.id)).toBeNull();
  });

  it("delete returns false for nonexistent category", () => {
    expect(repo.delete("nonexistent")).toBe(false);
  });

  it("delete reparents children to grandparent", () => {
    const root = repo.create("Root");
    const mid = repo.create("Mid", root.id);
    const leaf = repo.create("Leaf", mid.id);
    repo.delete(mid.id);
    expect(repo.findById(leaf.id)!.parent_id).toBe(root.id);
  });

  it("delete reparents children to null when deleting a root category", () => {
    const root = repo.create("Root");
    const child = repo.create("Child", root.id);
    repo.delete(root.id);
    expect(repo.findById(child.id)!.parent_id).toBeNull();
  });

  it("deleting a category sets bookmark category_id to NULL", () => {
    const cat = repo.create("Dev");
    db.run(
      "INSERT INTO bookmarks (url, domain, title, status) VALUES ('https://ex.com', 'ex.com', 'Ex', 'saved')"
    );
    const bm = db
      .query<{ id: string }, []>("SELECT id FROM bookmarks LIMIT 1")
      .get()!;
    db.run("UPDATE bookmarks SET category_id = ? WHERE id = ?", [cat.id, bm.id]);
    repo.delete(cat.id);
    const row = db
      .query<{ category_id: string | null }, [string]>(
        "SELECT category_id FROM bookmarks WHERE id = ?"
      )
      .get(bm.id);
    expect(row!.category_id).toBeNull();
  });

  // ─── listFlat / listTree ──────────────────────────────────────────────────

  it("listFlat returns all categories", () => {
    repo.create("Alpha");
    repo.create("Beta");
    const flat = repo.listFlat();
    expect(flat.map((c) => c.name)).toContain("Alpha");
    expect(flat.map((c) => c.name)).toContain("Beta");
  });

  it("listTree returns roots with nested children", () => {
    const root = repo.create("Root");
    repo.create("Child", root.id);
    const tree = repo.listTree();
    const rootNode = tree.find((n) => n.id === root.id);
    expect(rootNode).not.toBeUndefined();
    expect(rootNode!.children).toHaveLength(1);
    expect(rootNode!.children[0].name).toBe("Child");
  });

  it("listTree: deleted parent (ON DELETE SET NULL) promotes child to root", () => {
    // The schema uses ON DELETE SET NULL on parent_id, so deleting a parent
    // makes its children into roots (parent_id → NULL). listTree then shows them as roots.
    const parent = repo.create("Parent");
    const child = repo.create("Child", parent.id);
    db.run("DELETE FROM categories WHERE id = ?", [parent.id]);
    const tree = repo.listTree();
    const rootIds = tree.map((n) => n.id);
    // Parent is gone; child is now a root due to SET NULL
    expect(rootIds).not.toContain(parent.id);
    expect(rootIds).toContain(child.id);
  });
});
