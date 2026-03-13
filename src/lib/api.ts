/**
 * API client for the littleimpd daemon at http://127.0.0.1:3210
 */

export const DAEMON_URL = "http://127.0.0.1:3210";

// ─── API types (mirrors daemon DB types) ─────────────────────────────────────

export type BookmarkStatus =
  | "saved"
  | "fetched"
  | "extracted"
  | "ai_enriched"
  | "indexed";

export interface ApiBookmark {
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
  read_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface ApiBookmarkWithContent extends ApiBookmark {
  content: {
    bookmark_id: string;
    raw_html: string | null;
    markdown: string | null;
    summary: string | null;
    author: string | null;
    published_at: string | null;
    word_count: number | null;
    language: string | null;
    extracted_at: string;
  } | null;
}

export interface ApiCategory {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  children?: ApiCategory[];
  bookmark_count?: number;
}

export interface ApiTag {
  id: string;
  name: string;
  created_at: string;
  bookmark_count?: number;
}

export interface PipelineStatus {
  bookmarkId: string;
  bookmarkStatus: BookmarkStatus;
  job: {
    id: string;
    type: string;
    status: "pending" | "running" | "done" | "failed";
    error: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
  } | null;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ListResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiSettings {
  ai: {
    provider: "openai" | "ollama" | "none";
    openai: { api_key: string; model: string };
    ollama: { base_url: string; model: string };
  };
  embedding: {
    provider: "openai" | "ollama" | "none";
    openai: { api_key: string; model: string };
    ollama: { base_url: string; model: string };
  };
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string
  ) {
    super(detail ?? title);
    this.name = "ApiError";
  }
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${DAEMON_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let title = `HTTP ${res.status}`;
    let detail: string | undefined;
    try {
      const body = await res.json() as { title?: string; detail?: string };
      if (body.title) title = body.title;
      if (body.detail) detail = body.detail;
    } catch {}
    throw new ApiError(res.status, title, detail);
  }

  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export interface ListBookmarksParams {
  limit?: number;
  offset?: number;
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  /** When true, returns only archived bookmarks (for the /archive page). */
  archived?: boolean;
}

export async function listBookmarks(params: ListBookmarksParams = {}): Promise<ListResult<ApiBookmark>> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.tag) q.set("tag", params.tag);
  if (params.domain) q.set("domain", params.domain);
  if (params.category) q.set("category", params.category);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.archived) q.set("archived", "true");
  const qs = q.toString();
  return apiFetch<ListResult<ApiBookmark>>(`/bookmarks${qs ? `?${qs}` : ""}`);
}

export async function getBookmark(id: string): Promise<{ data: ApiBookmarkWithContent }> {
  return apiFetch<{ data: ApiBookmarkWithContent }>(`/bookmarks/${id}`);
}

export async function createBookmark(url: string, title?: string): Promise<{ data: ApiBookmark }> {
  return apiFetch<{ data: ApiBookmark }>("/bookmarks", {
    method: "POST",
    body: JSON.stringify({ url, title }),
  });
}

export async function updateBookmark(
  id: string,
  patch: {
    title?: string | null;
    category_id?: string | null;
    tags?: string[];
    is_pinned?: 0 | 1;
    is_archived?: 0 | 1;
    read_at?: string | null;
  }
): Promise<{ data: ApiBookmark }> {
  return apiFetch<{ data: ApiBookmark }>(`/bookmarks/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteBookmark(id: string): Promise<void> {
  await apiFetch<void>(`/bookmarks/${id}`, { method: "DELETE" });
}

export async function getBookmarkStatus(id: string): Promise<{ data: PipelineStatus }> {
  return apiFetch<{ data: PipelineStatus }>(`/bookmarks/${id}/status`);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchParams {
  q: string;
  mode?: "keyword" | "semantic" | "hybrid";
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function searchBookmarks(params: SearchParams): Promise<ListResult<ApiBookmark> & { meta: { mode: string } }> {
  const q = new URLSearchParams({ q: params.q });
  if (params.mode) q.set("mode", params.mode);
  if (params.tag) q.set("tag", params.tag);
  if (params.domain) q.set("domain", params.domain);
  if (params.category) q.set("category", params.category);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<ListResult<ApiBookmark> & { meta: { mode: string } }>(`/search?${q.toString()}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(): Promise<{ data: ApiCategory[] }> {
  return apiFetch<{ data: ApiCategory[] }>("/categories");
}

export async function createCategory(name: string, parent_id?: string | null): Promise<{ data: ApiCategory }> {
  return apiFetch<{ data: ApiCategory }>("/categories", {
    method: "POST",
    body: JSON.stringify({ name, parent_id: parent_id ?? null }),
  });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function listTags(): Promise<{ data: ApiTag[] }> {
  return apiFetch<{ data: ApiTag[] }>("/tags");
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  importId: string;
  total: number;
  warnings: number;
  progressUrl: string;
}

export async function importBookmarksFile(file: File): Promise<{ data: ImportResult }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${DAEMON_URL}/import`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let title = `HTTP ${res.status}`;
    let detail: string | undefined;
    try {
      const body = await res.json() as { title?: string; detail?: string };
      if (body.title) title = body.title;
      if (body.detail) detail = body.detail;
    } catch {}
    throw new ApiError(res.status, title, detail);
  }
  return res.json() as Promise<{ data: ImportResult }>;
}

/** Subscribe to import progress via SSE. Returns a cleanup function. */
export function subscribeToImportProgress(
  importId: string,
  onProgress: (state: { queued: number; skipped: number; total: number; done: boolean; error?: string | null }) => void
): () => void {
  const es = new EventSource(`${DAEMON_URL}/import/${importId}/progress`);
  es.addEventListener("progress", (e) => {
    try {
      onProgress(JSON.parse((e as MessageEvent).data));
    } catch {}
  });
  es.onerror = () => es.close();
  return () => es.close();
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export interface ApiDomain {
  domain: string;
  count: number;
}

export async function listDomains(): Promise<{ data: ApiDomain[] }> {
  return apiFetch<{ data: ApiDomain[] }>("/domains");
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | "category_created"
  | "category_merged"
  | "category_renamed"
  | "duplicate_removed"
  | "cluster_labeled";

export interface ApiTimelineEvent {
  id: string;
  type: TimelineEventType;
  description: string;
  metadata: Record<string, unknown>;
  source: "agent" | "user";
  created_at: string;
}

export async function listTimeline(
  params: { limit?: number; offset?: number } = {}
): Promise<{ data: ApiTimelineEvent[]; pagination: Pagination }> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<{ data: ApiTimelineEvent[]; pagination: Pagination }>(
    `/timeline${qs ? `?${qs}` : ""}`
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export type SuggestionType =
  | "new_subcategory"
  | "merge_categories"
  | "duplicate_bookmark";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface ApiSuggestion {
  id: string;
  bookmarkId: string | null;
  type: SuggestionType;
  value: string;
  metadata: Record<string, unknown>;
  confidence: number | null;
  status: SuggestionStatus;
  created_at: string;
  resolved_at: string | null;
}

export async function listSuggestions(): Promise<{
  data: ApiSuggestion[];
  meta: { pending: number };
}> {
  return apiFetch<{ data: ApiSuggestion[]; meta: { pending: number } }>("/suggestions");
}

export async function acceptSuggestion(id: string): Promise<{ data: ApiSuggestion }> {
  return apiFetch<{ data: ApiSuggestion }>(`/suggestions/${id}/accept`, { method: "POST" });
}

export async function rejectSuggestion(id: string): Promise<{ data: ApiSuggestion }> {
  return apiFetch<{ data: ApiSuggestion }>(`/suggestions/${id}/reject`, { method: "POST" });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<{ data: ApiSettings }> {
  return apiFetch<{ data: ApiSettings }>("/settings");
}

export async function updateSettings(patch: Partial<ApiSettings>): Promise<{ data: ApiSettings }> {
  return apiFetch<{ data: ApiSettings }>("/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
