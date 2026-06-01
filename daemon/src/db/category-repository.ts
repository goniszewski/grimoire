import { Database } from "bun:sqlite";
import type { CategoryRow } from "./types.js";

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface CategoryWithCount extends CategoryRow {
  bookmark_count: number;
}

export interface CategoryNode extends CategoryWithCount {
  children: CategoryNode[];
}

export interface CategoryMetadataPatch {
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  slug?: string | null;
  is_archived?: 0 | 1;
  is_public?: 0 | 1;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class CategoryRepository {
  constructor(private db: Database) {}

  /** List all categories flat, with bookmark counts. */
  listFlat(): CategoryWithCount[] {
    return this.db
      .query<CategoryWithCount, []>(
        `SELECT c.*,
                COUNT(b.id) AS bookmark_count
         FROM categories c
         LEFT JOIN bookmarks b ON b.category_id = c.id AND b.is_archived = 0 AND b.is_trashed = 0
         GROUP BY c.id
         ORDER BY c.name`
      )
      .all();
  }

  /** Build a tree (max 3 levels) from flat rows. Orphaned children are dropped. */
  listTree(): CategoryNode[] {
    const flat = this.listFlat();
    const map = new Map<string, CategoryNode>(
      flat.map((r) => [r.id, { ...r, children: [] }])
    );

    const roots: CategoryNode[] = [];
    for (const node of map.values()) {
      if (node.parent_id === null) {
        roots.push(node);
      } else {
        const parent = map.get(node.parent_id);
        if (parent) parent.children.push(node);
        // orphaned rows (unknown parent) are silently excluded
      }
    }

    return roots;
  }

  findById(id: string): CategoryRow | null {
    return (
      this.db
        .query<CategoryRow, [string]>("SELECT * FROM categories WHERE id = ?")
        .get(id) ?? null
    );
  }

  /** Returns depth of a category (root = 0). */
  depth(id: string): number {
    let depth = 0;
    let current = this.findById(id);
    while (current?.parent_id) {
      current = this.findById(current.parent_id);
      depth++;
      if (depth > 10) break; // safety guard against cycles
    }
    return depth;
  }

  /** Returns the deepest descendant distance for a category (leaf = 0). */
  subtreeHeight(id: string): number {
    const visited = new Set<string>([id]);

    const walk = (categoryId: string): number => {
      const children = this.db
        .query<{ id: string }, [string]>("SELECT id FROM categories WHERE parent_id = ?")
        .all(categoryId);

      let maxHeight = 0;
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        maxHeight = Math.max(maxHeight, 1 + walk(child.id));
      }
      return maxHeight;
    };

    return walk(id);
  }

  /**
   * Returns true if `ancestorId` is an ancestor of `nodeId` (or equal to it).
   * Used to prevent creating cycles when reparenting.
   */
  isAncestorOrSelf(ancestorId: string, nodeId: string): boolean {
    let current = this.findById(nodeId);
    let steps = 0;
    while (current) {
      if (current.id === ancestorId) return true;
      if (!current.parent_id) break;
      current = this.findById(current.parent_id);
      if (++steps > 10) break; // cycle guard
    }
    return false;
  }

  create(name: string, parentId?: string | null, metadata: CategoryMetadataPatch = {}): CategoryRow {
    const row = this.db
      .query<CategoryRow, [string, string | null, string | null, string | null, string | null, string | null, 0 | 1, 0 | 1]>(
        `INSERT INTO categories (name, parent_id, color, icon, description, slug, is_archived, is_public)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(
        name.trim(),
        parentId ?? null,
        metadata.color ?? null,
        metadata.icon ?? null,
        metadata.description ?? null,
        metadata.slug ?? null,
        metadata.is_archived ?? 0,
        metadata.is_public ?? 0
      );

    if (!row) throw new Error("Failed to insert category");
    return row;
  }

  update(id: string, patch: { name?: string; parent_id?: string | null } & CategoryMetadataPatch): CategoryRow | null {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if ("name" in patch && patch.name !== undefined) {
      sets.push("name = ?");
      params.push(patch.name.trim());
    }
    if ("parent_id" in patch) {
      sets.push("parent_id = ?");
      params.push(patch.parent_id ?? null);
    }
    if ("color" in patch) {
      sets.push("color = ?");
      params.push(patch.color ?? null);
    }
    if ("icon" in patch) {
      sets.push("icon = ?");
      params.push(patch.icon ?? null);
    }
    if ("description" in patch) {
      sets.push("description = ?");
      params.push(patch.description ?? null);
    }
    if ("slug" in patch) {
      sets.push("slug = ?");
      params.push(patch.slug ?? null);
    }
    if ("is_archived" in patch && patch.is_archived !== undefined) {
      sets.push("is_archived = ?");
      params.push(patch.is_archived);
    }
    if ("is_public" in patch && patch.is_public !== undefined) {
      sets.push("is_public = ?");
      params.push(patch.is_public);
    }

    if (sets.length === 0) return this.findById(id);

    this.db
      .query(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params, id);

    return this.findById(id);
  }

  /**
   * Delete a category. Bookmarks keep their rows; their category_id is set to
   * NULL by the ON DELETE SET NULL foreign key constraint. Children are
   * reparented to the deleted category's parent.
   */
  delete(id: string): boolean {
    const cat = this.findById(id);
    if (!cat) return false;

    this.db.transaction(() => {
      // Reparent direct children to the deleted node's parent
      this.db.run(
        "UPDATE categories SET parent_id = ? WHERE parent_id = ?",
        [cat.parent_id ?? null, id]
      );
      this.db.run("DELETE FROM categories WHERE id = ?", [id]);
    })();

    return true;
  }

  /** Find a category by exact name (case-insensitive). */
  findByName(name: string): CategoryRow | null {
    return (
      this.db
        .query<CategoryRow, [string]>(
          "SELECT * FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1"
        )
        .get(name) ?? null
    );
  }

  /** Find a category by name under the exact parent, case-insensitively. */
  findByNameAndParent(name: string, parentId: string | null): CategoryRow | null {
    if (parentId === null) {
      return (
        this.db
          .query<CategoryRow, [string]>(
            "SELECT * FROM categories WHERE name = ? COLLATE NOCASE AND parent_id IS NULL LIMIT 1"
          )
          .get(name) ?? null
      );
    }

    return (
      this.db
        .query<CategoryRow, [string, string]>(
          "SELECT * FROM categories WHERE name = ? COLLATE NOCASE AND parent_id = ? LIMIT 1"
        )
        .get(name, parentId) ?? null
    );
  }
}
