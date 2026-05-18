/**
 * API client for the littleimpd daemon at http://127.0.0.1:3210
 */

import type {
  BackupDestinationDto,
  BackupDestinationPatchDto,
  BackupDestinationResponseDto,
  BackupEntryDto,
  BackupListResponseDto,
  BackupResultDto,
  BackupScheduleDto,
  BackupSchedulePatchDto,
  BackupScheduleResponseDto,
  BackupVerificationResultDto,
  BackupVerifyRequestDto,
  BookmarkArrayResponseDto,
  BookmarkCreateRequestDto,
  BookmarkDetailDto,
  BookmarkDetailResponseDto,
  BookmarkDto,
  BookmarkListResponseDto,
  BookmarkPipelineStatusResponseDto,
  BookmarkResponseDto,
  BookmarkUpdateRequestDto,
  CategoryNodeDto,
  CategoryRecordDto,
  CategoryResponseDto,
  CategoryTreeResponseDto,
  ConnectivityTestResponseDto,
  DomainDto,
  DomainListResponseDto,
  ImportProgressEventDto,
  ImportSummaryResponseDto,
  PaginationDto,
  RelatedBookmarksResponseDto,
  RestoreRequestDto,
  RestoreResultDto,
  SearchResponseDto,
  SettingsDto,
  SettingsPatchDto,
  SuggestionDto,
  SuggestionsResponseDto,
  TagListResponseDto,
  TimelinePageDto,
} from "../../daemon/src/api/types";

export const DAEMON_URL = "http://127.0.0.1:3210";

// ─── API types (derived from daemon-owned contract) ──────────────────────────

type Simplify<T> = { [K in keyof T]: T[K] };

export interface ApiBookmark {
  id: BookmarkDto["id"];
  url: BookmarkDto["url"];
  domain: BookmarkDto["domain"];
  title: BookmarkDto["title"];
  description: BookmarkDto["description"];
  status: BookmarkDto["status"];
  category_id: BookmarkDto["category_id"];
  favicon_url: BookmarkDto["favicon_url"];
  screenshot_url: BookmarkDto["screenshot_url"];
  is_pinned: BookmarkDto["is_pinned"];
  is_archived: BookmarkDto["is_archived"];
  is_trashed: BookmarkDto["is_trashed"];
  trashed_at: BookmarkDto["trashed_at"];
  read_at: BookmarkDto["read_at"];
  notes: BookmarkDto["notes"];
  created_at: BookmarkDto["created_at"];
  updated_at: BookmarkDto["updated_at"];
  tags: BookmarkDto["tags"];
}

export type ApiBookmarkWithContent = ApiBookmark & {
  content: BookmarkDetailDto["content"];
};
export interface ApiCategory {
  id: CategoryNodeDto["id"];
  name: CategoryNodeDto["name"];
  parent_id: CategoryNodeDto["parent_id"];
  created_at: CategoryNodeDto["created_at"];
  updated_at: CategoryNodeDto["updated_at"];
  bookmark_count: CategoryNodeDto["bookmark_count"];
  children: ApiCategory[];
}

export interface ApiCategoryRecord {
  id: CategoryRecordDto["id"];
  name: CategoryRecordDto["name"];
  parent_id: CategoryRecordDto["parent_id"];
  created_at: CategoryRecordDto["created_at"];
  updated_at: CategoryRecordDto["updated_at"];
}
export type ApiTag = TagListResponseDto["data"][number];
export type PipelineStatus = BookmarkPipelineStatusResponseDto["data"];
export type Pagination = PaginationDto;

export interface ListResult<T> {
  data: T[];
  pagination: Pagination;
}

export type ApiSettingsPatch = SettingsPatchDto;
export type ApiAiProvider = SettingsDto["ai"]["provider"];
export type ApiEmbeddingProvider = SettingsDto["ai"]["embeddings"]["provider"];

export interface ApiRuntimeCapability {
  enabled: SettingsDto["runtime"]["llm"]["enabled"];
  provider: SettingsDto["runtime"]["llm"]["provider"];
  model: SettingsDto["runtime"]["llm"]["model"];
  base_url: SettingsDto["runtime"]["llm"]["base_url"];
}

export interface ApiRuntimeCapabilities {
  llm: ApiRuntimeCapability;
  embeddings: ApiRuntimeCapability;
  capabilities: {
    enrichment: SettingsDto["runtime"]["capabilities"]["enrichment"];
    semantic_search: SettingsDto["runtime"]["capabilities"]["semantic_search"];
    related_bookmarks: SettingsDto["runtime"]["capabilities"]["related_bookmarks"];
    organization_agent: SettingsDto["runtime"]["capabilities"]["organization_agent"];
  };
}

export interface ApiS3Config {
  endpoint: SettingsDto["backup"]["s3"]["endpoint"];
  bucket: SettingsDto["backup"]["s3"]["bucket"];
  access_key: SettingsDto["backup"]["s3"]["access_key"];
  secret_key: SettingsDto["backup"]["s3"]["secret_key"];
  region: SettingsDto["backup"]["s3"]["region"];
  prefix: SettingsDto["backup"]["s3"]["prefix"];
}

export interface ApiSettings {
  ai: {
    provider: ApiAiProvider;
    openai: {
      api_key: SettingsDto["ai"]["openai"]["api_key"];
      model: SettingsDto["ai"]["openai"]["model"];
    };
    ollama: {
      base_url: SettingsDto["ai"]["ollama"]["base_url"];
      model: SettingsDto["ai"]["ollama"]["model"];
    };
    embeddings: {
      provider: ApiEmbeddingProvider;
      model: SettingsDto["ai"]["embeddings"]["model"];
    };
  };
  app: {
    autostart: SettingsDto["app"]["autostart"];
    theme: SettingsDto["app"]["theme"];
    lock: {
      enabled: SettingsDto["app"]["lock"]["enabled"];
      pin_hash: SettingsDto["app"]["lock"]["pin_hash"];
    };
  };
  backup: {
    local: {
      destination_path: SettingsDto["backup"]["local"]["destination_path"];
    };
    schedule: {
      enabled: SettingsDto["backup"]["schedule"]["enabled"];
      cron: SettingsDto["backup"]["schedule"]["cron"];
      retention_count: SettingsDto["backup"]["schedule"]["retention_count"];
    };
    s3: ApiS3Config;
  };
  runtime: ApiRuntimeCapabilities;
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
      const body = await res.json() as { title?: string; detail?: string; error?: string };
      if (body.title) title = body.title;
      if (body.detail) detail = body.detail;
      else if (body.error) detail = body.error;
    } catch {
      // Keep the HTTP status fallback when the error body is not JSON.
    }
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

export async function listBookmarks(params: ListBookmarksParams = {}): Promise<BookmarkListResponseDto> {
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
  return apiFetch<BookmarkListResponseDto>(`/bookmarks${qs ? `?${qs}` : ""}`);
}

export async function getBookmark(id: string): Promise<BookmarkDetailResponseDto> {
  return apiFetch<BookmarkDetailResponseDto>(`/bookmarks/${id}`);
}

export async function createBookmark(url: string, title?: string): Promise<BookmarkResponseDto> {
  return apiFetch<BookmarkResponseDto>("/bookmarks", {
    method: "POST",
    body: JSON.stringify({ url, title } satisfies BookmarkCreateRequestDto),
  });
}

export async function updateBookmark(
  id: string,
  patch: BookmarkUpdateRequestDto
): Promise<BookmarkResponseDto> {
  return apiFetch<BookmarkResponseDto>(`/bookmarks/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteBookmark(id: string): Promise<void> {
  await apiFetch<void>(`/bookmarks/${id}`, { method: "DELETE" });
}

export async function restoreBookmark(id: string): Promise<BookmarkResponseDto> {
  return apiFetch<BookmarkResponseDto>(`/bookmarks/${id}/restore`, { method: "POST" });
}

export async function permanentDeleteBookmark(id: string): Promise<void> {
  await apiFetch<void>(`/bookmarks/${id}/permanent`, { method: "DELETE" });
}

export async function listTrashedBookmarks(): Promise<BookmarkArrayResponseDto> {
  return apiFetch<BookmarkArrayResponseDto>("/trash");
}

export async function getBookmarkStatus(id: string): Promise<BookmarkPipelineStatusResponseDto> {
  return apiFetch<BookmarkPipelineStatusResponseDto>(`/bookmarks/${id}/status`);
}

export async function getRelatedBookmarks(id: string, limit = 5): Promise<RelatedBookmarksResponseDto> {
  return apiFetch<RelatedBookmarksResponseDto>(`/bookmarks/${id}/related?limit=${limit}`);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchParams {
  q: string;
  mode?: SearchResponseDto["meta"]["mode"];
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function searchBookmarks(params: SearchParams): Promise<SearchResponseDto> {
  const q = new URLSearchParams({ q: params.q });
  if (params.mode) q.set("mode", params.mode);
  if (params.tag) q.set("tag", params.tag);
  if (params.domain) q.set("domain", params.domain);
  if (params.category) q.set("category", params.category);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<SearchResponseDto>(`/search?${q.toString()}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(): Promise<CategoryTreeResponseDto> {
  return apiFetch<CategoryTreeResponseDto>("/categories");
}

export async function createCategory(name: string, parent_id?: string | null): Promise<CategoryResponseDto> {
  return apiFetch<CategoryResponseDto>("/categories", {
    method: "POST",
    body: JSON.stringify({ name, parent_id: parent_id ?? null }),
  });
}

export async function updateCategory(
  id: string,
  patch: { name?: string; parent_id?: string | null }
): Promise<CategoryResponseDto> {
  return apiFetch<CategoryResponseDto>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch<unknown>(`/categories/${id}`, { method: "DELETE" });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function listTags(): Promise<TagListResponseDto> {
  return apiFetch<TagListResponseDto>("/tags");
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportResult = ImportSummaryResponseDto["data"];

export async function importBookmarksFile(file: File): Promise<ImportSummaryResponseDto> {
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
      const body = await res.json() as { title?: string; detail?: string; error?: string };
      if (body.title) title = body.title;
      if (body.detail) detail = body.detail;
      else if (body.error) detail = body.error;
    } catch {
      // Keep the HTTP status fallback when the error body is not JSON.
    }
    throw new ApiError(res.status, title, detail);
  }
  return res.json() as Promise<ImportSummaryResponseDto>;
}

/** Subscribe to import progress via SSE. Returns a cleanup function. */
export function subscribeToImportProgress(
  importId: string,
  onProgress: (state: ImportProgressEventDto) => void
): () => void {
  const es = new EventSource(`${DAEMON_URL}/import/${importId}/progress`);
  es.addEventListener("progress", (e) => {
    try {
      onProgress(JSON.parse((e as MessageEvent).data));
    } catch {
      // Ignore malformed progress events; the stream can continue.
    }
  });
  es.onerror = () => es.close();
  return () => es.close();
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export type ApiDomain = Simplify<DomainDto>;

export async function listDomains(): Promise<DomainListResponseDto> {
  return apiFetch<DomainListResponseDto>("/domains");
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface ApiTimelineEvent {
  id: TimelinePageDto["data"][number]["id"];
  type: TimelinePageDto["data"][number]["type"];
  description: TimelinePageDto["data"][number]["description"];
  metadata: TimelinePageDto["data"][number]["metadata"];
  source: TimelinePageDto["data"][number]["source"];
  created_at: TimelinePageDto["data"][number]["created_at"];
}
export type TimelineEventType = ApiTimelineEvent["type"];

export async function listTimeline(
  params: { limit?: number; offset?: number } = {}
): Promise<TimelinePageDto> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<TimelinePageDto>(`/timeline${qs ? `?${qs}` : ""}`);
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export interface ApiSuggestion {
  id: SuggestionDto["id"];
  bookmarkId: SuggestionDto["bookmarkId"];
  type: SuggestionDto["type"];
  value: SuggestionDto["value"];
  metadata: SuggestionDto["metadata"];
  confidence: SuggestionDto["confidence"];
  status: SuggestionDto["status"];
  created_at: SuggestionDto["created_at"];
  resolved_at: SuggestionDto["resolved_at"];
}
export type SuggestionType = ApiSuggestion["type"];
export type SuggestionStatus = ApiSuggestion["status"];

export async function listSuggestions(): Promise<SuggestionsResponseDto> {
  return apiFetch<SuggestionsResponseDto>("/suggestions");
}

export async function acceptSuggestion(id: string): Promise<{ data: SuggestionDto }> {
  return apiFetch<{ data: SuggestionDto }>(`/suggestions/${id}/accept`, { method: "POST" });
}

export async function rejectSuggestion(id: string): Promise<{ data: SuggestionDto }> {
  return apiFetch<{ data: SuggestionDto }>(`/suggestions/${id}/reject`, { method: "POST" });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<{ data: ApiSettings }> {
  return apiFetch<{ data: ApiSettings }>("/settings");
}

export async function updateSettings(patch: ApiSettingsPatch): Promise<{ data: ApiSettings }> {
  return apiFetch<{ data: ApiSettings }>("/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

// ─── Backup & Restore ─────────────────────────────────────────────────────────

export interface ApiBackupEntry {
  name: BackupEntryDto["name"];
  path: BackupEntryDto["path"];
  size_bytes: BackupEntryDto["size_bytes"];
  bookmark_count: BackupEntryDto["bookmark_count"];
  created_at: BackupEntryDto["created_at"];
  source: BackupEntryDto["source"];
}

export interface ApiBackupResult {
  path: BackupResultDto["path"];
  size_bytes: BackupResultDto["size_bytes"];
  bookmark_count: BackupResultDto["bookmark_count"];
  created_at: BackupResultDto["created_at"];
  remote_url?: BackupResultDto["remote_url"];
}

export interface ApiRestoreResult {
  restored_at: RestoreResultDto["restored_at"];
  bookmark_count: RestoreResultDto["bookmark_count"];
  checksum_verified: RestoreResultDto["checksum_verified"];
  rollback_path: RestoreResultDto["rollback_path"];
  restart_required: RestoreResultDto["restart_required"];
}

export interface ApiBackupVerificationResult {
  ok: BackupVerificationResultDto["ok"];
  name: BackupVerificationResultDto["name"];
  path: BackupVerificationResultDto["path"];
  checksum_verified: BackupVerificationResultDto["checksum_verified"];
  verified_files: BackupVerificationResultDto["verified_files"];
  bookmark_count: BackupVerificationResultDto["bookmark_count"];
  created_at: BackupVerificationResultDto["created_at"];
}

export async function createBackup(): Promise<BackupResultDto> {
  return apiFetch<BackupResultDto>("/backup", { method: "POST" });
}

export async function listBackups(includeRemote = false): Promise<BackupListResponseDto> {
  const url = includeRemote ? "/backup/list?include_remote=true" : "/backup/list";
  return apiFetch<BackupListResponseDto>(url);
}

/** Verify a local backup by directory name without restoring it. */
export async function verifyBackup(name: string): Promise<BackupVerificationResultDto> {
  return apiFetch<BackupVerificationResultDto>("/backup/verify", {
    method: "POST",
    body: JSON.stringify({ name } satisfies BackupVerifyRequestDto),
  });
}

/** Restore from a local backup by its directory name (basename only — no path traversal). */
export async function restoreBackup(name: string): Promise<RestoreResultDto> {
  return apiFetch<RestoreResultDto>("/restore", {
    method: "POST",
    body: JSON.stringify({ name } satisfies RestoreRequestDto),
  });
}

/** Restore from a remote S3 backup by its object key. */
export async function restoreRemoteBackup(key: string): Promise<RestoreResultDto> {
  return apiFetch<RestoreResultDto>("/restore", {
    method: "POST",
    body: JSON.stringify({ source: "remote", key } satisfies RestoreRequestDto),
  });
}

/** Test the S3 connection using current backup.s3 settings. */
export async function testS3Connection(): Promise<ConnectivityTestResponseDto> {
  return apiFetch<ConnectivityTestResponseDto>("/settings/test-s3", { method: "POST" });
}

// ─── Backup schedule ──────────────────────────────────────────────────────────

export interface ApiBackupSchedule {
  enabled: BackupScheduleDto["enabled"];
  cron: BackupScheduleDto["cron"];
  retention_count: BackupScheduleDto["retention_count"];
  next_run_at: BackupScheduleDto["next_run_at"];
}

export async function getBackupSchedule(): Promise<BackupScheduleResponseDto> {
  return apiFetch<BackupScheduleResponseDto>("/backup/schedule");
}

export async function updateBackupSchedule(
  patch: BackupSchedulePatchDto
): Promise<BackupScheduleResponseDto> {
  return apiFetch<BackupScheduleResponseDto>("/backup/schedule", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

// ─── Backup destination ───────────────────────────────────────────────────────

export interface ApiBackupDestination {
  path: BackupDestinationDto["path"];
  is_custom: BackupDestinationDto["is_custom"];
  writable: BackupDestinationDto["writable"];
}

export async function getBackupDestination(): Promise<BackupDestinationResponseDto> {
  return apiFetch<BackupDestinationResponseDto>("/backup/destination");
}

export async function updateBackupDestination(path: string): Promise<BackupDestinationResponseDto> {
  const patch: BackupDestinationPatchDto = { path };
  return apiFetch<BackupDestinationResponseDto>("/backup/destination", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
