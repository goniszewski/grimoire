// ─── Row types (mirror the SQL schema) ───────────────────────────────────────

export type BookmarkStatus =
  | "saved"
  | "fetched"
  | "extracted"
  | "ai_enriched"
  | "indexed";

export type JobStatus = "pending" | "running" | "done" | "failed";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface BookmarkRow {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  status: BookmarkStatus;
  category_id: string | null;
  favicon_url: string | null;
  screenshot_url: string | null;
  is_pinned: 0 | 1;
  is_archived: 0 | 1;
  is_trashed: 0 | 1;
  trashed_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookmarkContentRow {
  bookmark_id: string;
  raw_html: string | null;
  markdown: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  word_count: number | null;
  language: string | null;
  extracted_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  type: string;
  status: JobStatus;
  payload: string; // JSON
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface AgentSuggestionRow {
  id: string;
  bookmark_id: string | null;
  type: string;
  value: string;
  metadata: string; // JSON
  confidence: number | null;
  status: SuggestionStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface TimelineEventRow {
  id: string;
  bookmark_id: string | null;
  event_type: string;
  payload: string; // JSON
  created_at: string;
}

export interface EmbeddingRow {
  bookmark_id: string;
  model: string;
  dimensions: number;
  vector: Uint8Array; // packed float32 LE
  created_at: string;
}

export interface MigrationRow {
  version: string;
  applied_at: string;
}
