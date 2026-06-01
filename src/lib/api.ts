/**
 * API client for the local littleimpd daemon.
 */

import type {
  BackupDestinationDto,
  BackupDestinationPatchDto,
  BackupDestinationResponseDto,
  BackupEntryDto,
  BackupListResponseDto,
  BackupPackageRequestDto,
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
  EncryptedBackupPackageRequestDto,
  EncryptedBackupPackageResultDto,
  EncryptedBackupPackageVerificationResultDto,
  HealthResponseDto,
  ImportDuplicatePolicyDto,
  ImportFolderRemappingInputDto,
  ImportProgressEventDto,
  ImportRemappingInputDto,
  ImportRemappingDto,
  ImportPreviewResponseDto,
  ImportSummaryResponseDto,
  ImportTagRemappingInputDto,
  PaginationDto,
  RelatedBookmarksResponseDto,
  ReprocessBatchResponseDto,
  ReprocessBatchStatusResponseDto,
  ReprocessRequestDto,
  RestoreRequestDto,
  RestoreResultDto,
  SearchResponseDto,
  SettingsDto,
  SettingsPatchDto,
  SuggestionDto,
  SuggestionsResponseDto,
  TagListResponseDto,
  TagRequestDto,
  TagResponseDto,
  TimelinePageDto,
  UpdateCheckResponseDto,
  UpdateCheckResultDto,
} from "../../daemon/src/api/types";

const DEFAULT_DAEMON_URL = "http://127.0.0.1:3210";

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function resolveDaemonUrl(rawUrl = import.meta.env.VITE_DAEMON_URL): string {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return DEFAULT_DAEMON_URL;

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    throw new Error("VITE_DAEMON_URL must be a valid http:// or https:// URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("VITE_DAEMON_URL must be a valid http:// or https:// URL");
  }

  if (!isLoopbackHostname(parsed.hostname)) {
    throw new Error("VITE_DAEMON_URL must point to localhost, 127.0.0.1, or ::1");
  }

  return parsed.origin;
}

export const DAEMON_URL = resolveDaemonUrl();

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
  read_later: BookmarkDto["read_later"];
  read_at: BookmarkDto["read_at"];
  opened_count: BookmarkDto["opened_count"];
  last_opened_at: BookmarkDto["last_opened_at"];
  notes: BookmarkDto["notes"];
  created_at: BookmarkDto["created_at"];
  updated_at: BookmarkDto["updated_at"];
  tags: BookmarkDto["tags"];
}

export interface ApiBookmarkMediaItem {
  id: string;
  kind: "favicon" | "screenshot" | "image";
  url: string;
  source_url: string;
  media_type: string;
  size_bytes: number;
  alt: string | null;
}

export interface ApiBookmarkMediaSet {
  favicon: ApiBookmarkMediaItem | null;
  screenshot: ApiBookmarkMediaItem | null;
  images: ApiBookmarkMediaItem[];
}

export type ApiBookmarkWithContent = ApiBookmark & {
  content: BookmarkDetailDto["content"];
  media: ApiBookmarkMediaSet;
};
export interface ApiBookmarkOpenMetrics {
  id: string;
  opened_count: number;
  last_opened_at: string | null;
}
export interface ApiCategory {
  id: CategoryNodeDto["id"];
  name: CategoryNodeDto["name"];
  parent_id: CategoryNodeDto["parent_id"];
  color: CategoryNodeDto["color"];
  icon: CategoryNodeDto["icon"];
  description: CategoryNodeDto["description"];
  slug: CategoryNodeDto["slug"];
  is_archived: CategoryNodeDto["is_archived"];
  is_public: CategoryNodeDto["is_public"];
  created_at: CategoryNodeDto["created_at"];
  updated_at: CategoryNodeDto["updated_at"];
  bookmark_count: CategoryNodeDto["bookmark_count"];
  children: ApiCategory[];
}

export interface ApiCategoryRecord {
  id: CategoryRecordDto["id"];
  name: CategoryRecordDto["name"];
  parent_id: CategoryRecordDto["parent_id"];
  color: CategoryRecordDto["color"];
  icon: CategoryRecordDto["icon"];
  description: CategoryRecordDto["description"];
  slug: CategoryRecordDto["slug"];
  is_archived: CategoryRecordDto["is_archived"];
  is_public: CategoryRecordDto["is_public"];
  created_at: CategoryRecordDto["created_at"];
  updated_at: CategoryRecordDto["updated_at"];
}
type ApiTagDto = TagListResponseDto["data"][number];
type ApiTagRecordDto = TagResponseDto["data"];

export interface ApiTag {
  id: ApiTagDto["id"];
  name: ApiTagDto["name"];
  created_at: ApiTagDto["created_at"];
  bookmark_count: ApiTagDto["bookmark_count"];
}

export interface ApiTagRecord {
  id: ApiTagRecordDto["id"];
  name: ApiTagRecordDto["name"];
  created_at: ApiTagRecordDto["created_at"];
}

export type ApiTagListResponse = Simplify<{ data: ApiTag[] }>;
export type ApiTagResponse = Simplify<{ data: ApiTagRecord }>;
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

export interface ApiEmbeddingRuntimeCapability {
  enabled: SettingsDto["runtime"]["embeddings"]["enabled"];
  provider: SettingsDto["runtime"]["embeddings"]["provider"];
  model: SettingsDto["runtime"]["embeddings"]["model"];
  base_url: SettingsDto["runtime"]["embeddings"]["base_url"];
}

export interface ApiRuntimeCapabilities {
  llm: ApiRuntimeCapability;
  embeddings: ApiEmbeddingRuntimeCapability;
  capabilities: {
    enrichment: SettingsDto["runtime"]["capabilities"]["enrichment"];
    semantic_search: SettingsDto["runtime"]["capabilities"]["semantic_search"];
    related_bookmarks: SettingsDto["runtime"]["capabilities"]["related_bookmarks"];
    organization_agent: SettingsDto["runtime"]["capabilities"]["organization_agent"];
  };
}

export type ApiUpdateCheckResult = UpdateCheckResultDto;

export interface ApiDiagnosticsProviderStatus {
  provider: string;
  configured: boolean;
  model: string | null;
  base_url: string | null;
}

export interface ApiDiagnostics {
  generated_at: string;
  version: string;
  platform: {
    os: string;
    arch: string;
    bun_version: string;
    node_env: string;
    host: string;
    port: number;
  };
  install: {
    mode: "development" | "native" | "docker";
  };
  paths: {
    data_dir: string;
    database_path: string;
    config_file: string;
    backup_dir: string;
    frontend_dist: string | null;
    log_files: Array<{ label: string; path: string }>;
  };
  daemon: {
    status: "ok";
    uptime_ms: number;
    queue_size: number;
    queue: {
      pending: number;
      running: number;
      done: number;
      failed: number;
    };
  };
  providers: {
    llm: ApiDiagnosticsProviderStatus;
    embeddings: ApiDiagnosticsProviderStatus;
  };
  backup: {
    local: {
      path: string;
      is_custom: boolean;
      writable: boolean;
    };
    schedule: {
      enabled: boolean;
      cron: string;
      retention_count: number;
      next_run_at: string | null;
    };
    s3: {
      configured: boolean;
      endpoint: string;
      bucket: string;
      region: string;
      prefix: string;
    };
  };
  search: {
    keyword: boolean;
    semantic: boolean;
    hybrid: boolean;
  };
  omitted_secrets: string[];
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
    anthropic: {
      api_key: SettingsDto["ai"]["anthropic"]["api_key"];
      base_url: SettingsDto["ai"]["anthropic"]["base_url"];
      model: SettingsDto["ai"]["anthropic"]["model"];
    };
    openrouter: {
      api_key: SettingsDto["ai"]["openrouter"]["api_key"];
      base_url: SettingsDto["ai"]["openrouter"]["base_url"];
      model: SettingsDto["ai"]["openrouter"]["model"];
    };
    openai_compatible: {
      api_key: SettingsDto["ai"]["openai_compatible"]["api_key"];
      base_url: SettingsDto["ai"]["openai_compatible"]["base_url"];
      model: SettingsDto["ai"]["openai_compatible"]["model"];
    };
    deepseek: {
      api_key: SettingsDto["ai"]["deepseek"]["api_key"];
      base_url: SettingsDto["ai"]["deepseek"]["base_url"];
      model: SettingsDto["ai"]["deepseek"]["model"];
    };
    embeddings: {
      provider: ApiEmbeddingProvider;
      model: SettingsDto["ai"]["embeddings"]["model"];
      openai_compatible: {
        api_key: SettingsDto["ai"]["embeddings"]["openai_compatible"]["api_key"];
        base_url: SettingsDto["ai"]["embeddings"]["openai_compatible"]["base_url"];
        model: SettingsDto["ai"]["embeddings"]["openai_compatible"]["model"];
      };
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
  return (await fetchHealth(`${DAEMON_URL}/health`)) !== null;
}

export async function checkHealthAfterRestore(restoredAt: string, healthUrl: string): Promise<boolean> {
  const health = await fetchHealth(healthUrl);
  if (!health) return false;

  const restoredAtMs = Date.parse(restoredAt);
  if (!Number.isFinite(restoredAtMs)) return false;

  const processStartedAtMs = Date.now() - health.uptime;
  return processStartedAtMs > restoredAtMs;
}

async function fetchHealth(url: string): Promise<HealthResponseDto | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    let signal: AbortSignal | undefined;
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(3000);
    } else if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 3000);
      signal = controller.signal;
    }
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res.ok) return null;
    const body = await res.json() as Partial<HealthResponseDto>;
    if (
      body.status !== "ok" ||
      typeof body.version !== "string" ||
      typeof body.uptime !== "number" ||
      !Number.isFinite(body.uptime) ||
      body.uptime < 0 ||
      typeof body.queueSize !== "number" ||
      !Number.isFinite(body.queueSize) ||
      body.queueSize < 0
    ) {
      return null;
    }
    return body as HealthResponseDto;
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export interface ListBookmarksParams {
  limit?: number;
  offset?: number;
  tag?: string;
  domain?: string;
  category_id?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  read_later?: boolean;
  /** When true, returns only archived bookmarks (for the /archive page). */
  archived?: boolean;
}

export async function listBookmarks(params: ListBookmarksParams = {}): Promise<BookmarkListResponseDto> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.tag) q.set("tag", params.tag);
  if (params.domain) q.set("domain", params.domain);
  if (params.category_id) q.set("category_id", params.category_id);
  if (params.category) q.set("category", params.category);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.read_later != null) q.set("read_later", params.read_later ? "true" : "false");
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

export async function recordBookmarkOpen(id: string): Promise<{ data: ApiBookmarkOpenMetrics }> {
  return apiFetch<{ data: ApiBookmarkOpenMetrics }>(`/bookmarks/${id}/open`, { method: "POST" });
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

export type ApiReprocessRequest = ReprocessRequestDto;
export type ApiReprocessBatch = ReprocessBatchResponseDto["data"];
export type ApiReprocessBatchStatus = ReprocessBatchStatusResponseDto["data"];

export async function reprocessBookmarks(
  request: ReprocessRequestDto
): Promise<ReprocessBatchResponseDto> {
  return apiFetch<ReprocessBatchResponseDto>("/bookmarks/reprocess", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function retryBookmarkPipeline(id: string): Promise<ReprocessBatchResponseDto> {
  return apiFetch<ReprocessBatchResponseDto>(`/bookmarks/${id}/retry`, { method: "POST" });
}

export async function dismissBookmarkFailure(id: string): Promise<void> {
  await apiFetch<void>(`/bookmarks/${id}/failure/dismiss`, { method: "POST" });
}

export async function getReprocessStatus(batchId: string): Promise<ReprocessBatchStatusResponseDto> {
  return apiFetch<ReprocessBatchStatusResponseDto>(`/reprocess/${batchId}`);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchParams {
  q: string;
  mode?: SearchResponseDto["meta"]["mode"];
  tag?: string;
  domain?: string;
  category_id?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  read_later?: boolean;
  limit?: number;
  offset?: number;
}

export async function searchBookmarks(params: SearchParams): Promise<SearchResponseDto> {
  const q = new URLSearchParams({ q: params.q });
  if (params.mode) q.set("mode", params.mode);
  if (params.tag) q.set("tag", params.tag);
  if (params.domain) q.set("domain", params.domain);
  if (params.category_id) q.set("category_id", params.category_id);
  if (params.category) q.set("category", params.category);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.read_later != null) q.set("read_later", params.read_later ? "true" : "false");
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<SearchResponseDto>(`/search?${q.toString()}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(): Promise<CategoryTreeResponseDto> {
  return apiFetch<CategoryTreeResponseDto>("/categories");
}

export async function createCategory(
  name: string,
  parent_id?: string | null,
  metadata: Omit<Partial<CategoryRecordDto>, "id" | "name" | "parent_id" | "created_at" | "updated_at"> = {}
): Promise<CategoryResponseDto> {
  return apiFetch<CategoryResponseDto>("/categories", {
    method: "POST",
    body: JSON.stringify({ name, parent_id: parent_id ?? null, ...metadata }),
  });
}

export async function updateCategory(
  id: string,
  patch: Omit<Partial<CategoryRecordDto>, "id" | "created_at" | "updated_at">
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

export async function listTags(): Promise<ApiTagListResponse> {
  return apiFetch<ApiTagListResponse>("/tags");
}

export async function createTag(name: string): Promise<ApiTagResponse> {
  return apiFetch<ApiTagResponse>("/tags", {
    method: "POST",
    body: JSON.stringify({ name } satisfies TagRequestDto),
  });
}

export async function renameTag(id: string, name: string): Promise<ApiTagResponse> {
  return apiFetch<ApiTagResponse>(`/tags/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name } satisfies TagRequestDto),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await apiFetch<void>(`/tags/${id}`, { method: "DELETE" });
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportResult = ImportSummaryResponseDto["data"];
export type ImportDuplicatePolicy = Partial<ImportDuplicatePolicyDto>;
export type ApiImportRemapping = ImportRemappingDto;
export type ImportPreview = ImportPreviewResponseDto["data"];

export type ImportFolderRemappingInput = ImportFolderRemappingInputDto;
export type ImportTagRemappingInput = ImportTagRemappingInputDto;
export type ImportRemappingInput = ImportRemappingInputDto;

function importFormData(
  file: File,
  duplicatePolicy?: ImportDuplicatePolicy,
  remapping?: ImportRemappingInput
): FormData {
  const form = new FormData();
  form.append("file", file);
  if (duplicatePolicy) {
    form.append("duplicatePolicy", JSON.stringify(duplicatePolicy));
  }
  if (remapping) {
    form.append("remapping", JSON.stringify(remapping));
  }
  return form;
}

async function fetchImportForm<T>(
  path: string,
  file: File,
  duplicatePolicy?: ImportDuplicatePolicy,
  remapping?: ImportRemappingInput
): Promise<T> {
  const res = await fetch(`${DAEMON_URL}${path}`, {
    method: "POST",
    body: importFormData(file, duplicatePolicy, remapping),
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
  return res.json() as Promise<T>;
}

export async function previewImportBookmarksFile(
  file: File,
  duplicatePolicy?: ImportDuplicatePolicy,
  remapping?: ImportRemappingInput
): Promise<ImportPreviewResponseDto> {
  return fetchImportForm<ImportPreviewResponseDto>("/import/preview", file, duplicatePolicy, remapping);
}

export async function importBookmarksFile(
  file: File,
  duplicatePolicy?: ImportDuplicatePolicy,
  remapping?: ImportRemappingInput
): Promise<ImportSummaryResponseDto> {
  return fetchImportForm<ImportSummaryResponseDto>("/import", file, duplicatePolicy, remapping);
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

export async function getDiagnostics(): Promise<{ data: ApiDiagnostics }> {
  return apiFetch<{ data: ApiDiagnostics }>("/diagnostics");
}

// ─── Updates ──────────────────────────────────────────────────────────────────

export async function checkForUpdates(): Promise<UpdateCheckResponseDto> {
  return apiFetch<UpdateCheckResponseDto>("/updates/check");
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
  restart_command: RestoreResultDto["restart_command"];
  health_url: RestoreResultDto["health_url"];
  rollback_instructions: RestoreResultDto["rollback_instructions"];
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

export interface ApiEncryptedBackupPackageResult {
  path: EncryptedBackupPackageResultDto["path"];
  source_path: EncryptedBackupPackageResultDto["source_path"];
  encrypted: EncryptedBackupPackageResultDto["encrypted"];
  size_bytes: EncryptedBackupPackageResultDto["size_bytes"];
  created_at: EncryptedBackupPackageResultDto["created_at"];
}

export interface ApiEncryptedBackupPackageVerificationResult {
  ok: EncryptedBackupPackageVerificationResultDto["ok"];
  path: EncryptedBackupPackageVerificationResultDto["path"];
  package_encrypted: EncryptedBackupPackageVerificationResultDto["package_encrypted"];
  checksum_verified: EncryptedBackupPackageVerificationResultDto["checksum_verified"];
  verified_files: EncryptedBackupPackageVerificationResultDto["verified_files"];
  bookmark_count: EncryptedBackupPackageVerificationResultDto["bookmark_count"];
  created_at: EncryptedBackupPackageVerificationResultDto["created_at"];
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

/** Create an encrypted package from an existing local backup by directory name. */
export async function createEncryptedBackupPackage(
  request: BackupPackageRequestDto
): Promise<EncryptedBackupPackageResultDto> {
  return apiFetch<EncryptedBackupPackageResultDto>("/backup/package", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Verify an encrypted package by daemon-local absolute path without restoring it. */
export async function verifyEncryptedBackupPackage(
  request: EncryptedBackupPackageRequestDto
): Promise<EncryptedBackupPackageVerificationResultDto> {
  return apiFetch<EncryptedBackupPackageVerificationResultDto>("/backup/package/verify", {
    method: "POST",
    body: JSON.stringify(request),
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

/** Restore an encrypted package by daemon-local absolute path. */
export async function restoreEncryptedBackupPackage(
  request: EncryptedBackupPackageRequestDto
): Promise<RestoreResultDto> {
  return apiFetch<RestoreResultDto>("/restore", {
    method: "POST",
    body: JSON.stringify({ source: "encrypted_package", ...request } satisfies RestoreRequestDto),
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
