import { Database } from "bun:sqlite";
import { AgentSuggestionRow, SuggestionStatus } from "./types.js";

// ─── Suggestion types ─────────────────────────────────────────────────────────

export type SuggestionType =
  | "new_subcategory"
  | "merge_categories"
  | "duplicate_bookmark";

export interface Suggestion {
  id: string;
  bookmarkId: string | null;
  type: SuggestionType;
  /** Human-readable description of the suggestion. */
  value: string;
  /** Structured context: affected bookmark/category IDs. */
  metadata: Record<string, unknown>;
  confidence: number | null;
  status: SuggestionStatus;
  created_at: string;
  resolved_at: string | null;
}

// ─── Repository ───────────────────────────────────────────────────────────────

function toSuggestion(row: AgentSuggestionRow): Suggestion {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {}

  return {
    id: row.id,
    bookmarkId: row.bookmark_id,
    type: row.type as SuggestionType,
    value: row.value,
    metadata,
    confidence: row.confidence,
    status: row.status,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  };
}

export class SuggestionRepository {
  constructor(private db: Database) {}

  /** List all pending suggestions, newest first. */
  listPending(): Suggestion[] {
    const rows = this.db
      .query<AgentSuggestionRow, []>(
        `SELECT * FROM agent_suggestions
         WHERE status = 'pending'
         ORDER BY created_at DESC`
      )
      .all();
    return rows.map(toSuggestion);
  }

  /** Count pending suggestions. */
  countPending(): number {
    return (
      this.db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM agent_suggestions WHERE status = 'pending'"
        )
        .get()?.count ?? 0
    );
  }

  findById(id: string): Suggestion | null {
    const row = this.db
      .query<AgentSuggestionRow, [string]>(
        "SELECT * FROM agent_suggestions WHERE id = ?"
      )
      .get(id);
    return row ? toSuggestion(row) : null;
  }

  insert(
    type: SuggestionType,
    value: string,
    metadata: Record<string, unknown> = {},
    confidence: number | null = null,
    bookmarkId?: string | null
  ): Suggestion {
    const row = this.db
      .query<AgentSuggestionRow, [string, string | null, string, number | null, string]>(
        `INSERT INTO agent_suggestions (type, bookmark_id, value, confidence, metadata)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(type, bookmarkId ?? null, value, confidence, JSON.stringify(metadata));

    if (!row) throw new Error("Failed to insert suggestion");
    return toSuggestion(row);
  }

  /** Mark a suggestion accepted and record resolution time. */
  accept(id: string): Suggestion | null {
    this.db.run(
      `UPDATE agent_suggestions
       SET status = 'accepted', resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status = 'pending'`,
      [id]
    );
    return this.findById(id);
  }

  /** Mark a suggestion rejected and record resolution time. */
  reject(id: string): Suggestion | null {
    this.db.run(
      `UPDATE agent_suggestions
       SET status = 'rejected', resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status = 'pending'`,
      [id]
    );
    return this.findById(id);
  }

  /**
   * Check whether an equivalent pending suggestion already exists.
   * Prevents the agent from flooding the queue with duplicates across runs.
   */
  hasPending(type: SuggestionType, value: string): boolean {
    const row = this.db
      .query<{ c: number }, [string, string]>(
        `SELECT COUNT(*) AS c FROM agent_suggestions
         WHERE type = ? AND value = ? AND status = 'pending'`
      )
      .get(type, value);
    return (row?.c ?? 0) > 0;
  }
}
