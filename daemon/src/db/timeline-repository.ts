import { Database } from "bun:sqlite";
import { TimelineEventRow } from "./types.js";

export type TimelineEventType =
  | "category_created"
  | "category_merged"
  | "category_merge_suggested"
  | "category_renamed"
  | "category_reparented"
  | "category_deleted"
  | "duplicate_removed"
  | "duplicate_flagged"
  | "cluster_labeled"
  | "suggestion_accepted"
  | "suggestion_rejected";

export type TimelineSource = "agent" | "user";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  description: string;
  metadata: Record<string, unknown>;
  source: TimelineSource;
  created_at: string;
}

export interface TimelinePage {
  data: TimelineEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

function toEvent(row: TimelineEventRow): TimelineEvent {
  let metadata: Record<string, unknown> = {};
  let description = "";
  let source: TimelineSource = "user";

  try {
    const payload = JSON.parse(row.payload) as {
      description?: string;
      source?: string;
      [key: string]: unknown;
    };
    description = typeof payload.description === "string" ? payload.description : row.event_type;
    source = payload.source === "agent" ? "agent" : "user";
    const { description: _d, source: _s, ...rest } = payload;
    metadata = rest;
  } catch {
    description = row.event_type;
  }

  return {
    id: row.id,
    type: row.event_type as TimelineEventType,
    description,
    metadata,
    source,
    created_at: row.created_at,
  };
}

export class TimelineRepository {
  constructor(private db: Database) {}

  list(limit = 50, offset = 0): TimelinePage {
    const total =
      (
        this.db
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM timeline_events"
          )
          .get() ?? { count: 0 }
      ).count;

    const rows = this.db
      .query<TimelineEventRow, [number, number]>(
        `SELECT * FROM timeline_events
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    return {
      data: rows.map(toEvent),
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + rows.length < total,
      },
    };
  }

  insert(
    type: TimelineEventType,
    description: string,
    metadata: Record<string, unknown> = {},
    source: TimelineSource = "user",
    bookmarkId?: string | null
  ): TimelineEvent {
    const payload = JSON.stringify({ ...metadata, description, source });

    const row = this.db
      .query<TimelineEventRow, [string, string | null, string]>(
        `INSERT INTO timeline_events (event_type, bookmark_id, payload)
         VALUES (?, ?, ?)
         RETURNING *`
      )
      .get(type, bookmarkId ?? null, payload);

    if (!row) throw new Error("Failed to insert timeline event");
    return toEvent(row);
  }
}
