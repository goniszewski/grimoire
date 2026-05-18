import type {
  ApiContract,
  ApiNumberSchema,
  ApiObjectSchema,
  ApiResponse,
  ApiSchema,
  ApiSchemaMap,
  ApiStringSchema,
} from "./schema.js";

type EmptySchemaOptions = Record<never, never>;

const stringSchema = <const Options extends Omit<ApiStringSchema, "type" | "description"> = EmptySchemaOptions>(
  description: string,
  options = {} as Options
) => ({ type: "string", description, ...options }) as const;

const integerSchema = <const Options extends Omit<ApiNumberSchema, "type" | "description"> = EmptySchemaOptions>(
  description: string,
  options = {} as Options
) => ({ type: "integer", description, ...options }) as const;

const numberSchema = <const Options extends Omit<ApiNumberSchema, "type" | "description"> = EmptySchemaOptions>(
  description: string,
  options = {} as Options
) => ({ type: "number", description, ...options }) as const;

const booleanSchema = (description: string) => ({ type: "boolean", description }) as const;
const ref = <const Name extends string>(name: Name) => ({ ref: name }) as const;
const arrayOf = <const Item extends ApiSchema>(items: Item, description: string) =>
  ({ type: "array", description, items }) as const;

type ContractObjectSchema<
  Properties extends Record<string, ApiSchema>,
  Required extends readonly (keyof Properties & string)[],
  AdditionalProperties extends boolean | ApiSchema = false,
> = {
  readonly type: "object";
  readonly properties: Properties;
  readonly required: Required;
  readonly additionalProperties: AdditionalProperties;
  readonly description?: string;
};

function objectSchema<const Properties extends Record<string, ApiSchema>>(
  properties: Properties
): ContractObjectSchema<Properties, [], false>;
function objectSchema<
  const Properties extends Record<string, ApiSchema>,
  const Required extends readonly (keyof Properties & string)[],
  const AdditionalProperties extends boolean | ApiSchema = false,
>(
  properties: Properties,
  required: Required,
  description?: string,
  additionalProperties?: AdditionalProperties
): ContractObjectSchema<Properties, Required, AdditionalProperties>;
function objectSchema(
  properties: Record<string, ApiSchema>,
  required: readonly string[] = [],
  description?: string,
  additionalProperties: boolean | ApiSchema = false
) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties,
    ...(description ? { description } : {}),
  } as const;
}

const nullable = <const Schema extends ApiSchema>(schema: Schema) =>
  ({ ...schema, nullable: true }) as const;

const envelope = <const Schema extends ApiSchema>(schema: Schema, description = "Response data") =>
  objectSchema({ data: schema }, ["data"], description);

const paginatedEnvelope = <const Item extends ApiSchema>(
  item: Item,
  description = "Paginated response"
) =>
  objectSchema(
    {
      data: arrayOf(item, "Page items"),
      pagination: ref("Pagination"),
    },
    ["data", "pagination"],
    description
  );

const jsonResponse = (description: string, schema: ApiSchema): ApiResponse => ({
  description,
  contentType: "application/json",
  schema,
});

const problemResponse = (description: string): ApiResponse => ({
  description,
  contentType: "application/problem+json",
  schema: ref("ProblemDetails"),
});

const legacyErrorResponse = (description: string): ApiResponse => ({
  description,
  contentType: "application/json",
  schema: ref("LegacyError"),
});

const noContentResponse = (description: string): ApiResponse => ({ description });

const idParam = (name = "id"): ApiObjectSchema =>
  objectSchema({ [name]: stringSchema(`${name} path parameter`) }, [name]);

const pagingQuery = objectSchema({
  limit: integerSchema("Maximum number of results to return", { minimum: 1 }),
  offset: integerSchema("Number of results to skip", { minimum: 0 }),
});

const bookmarkFilters = {
  tag: stringSchema("Filter by tag name"),
  domain: stringSchema("Filter by exact domain"),
  category: stringSchema("Filter by category name"),
  date_from: stringSchema("Inclusive ISO date or date-time lower bound"),
  date_to: stringSchema("Inclusive ISO date or date-time upper bound"),
};

const bookmarkProperties = {
  id: stringSchema("Bookmark ID"),
  url: stringSchema("Original bookmark URL", { format: "uri" }),
  domain: stringSchema("URL hostname"),
  title: nullable(stringSchema("Page title")),
  description: nullable(stringSchema("Page description")),
  status: stringSchema("Pipeline status", {
    enum: ["saved", "fetched", "extracted", "ai_enriched", "indexed"],
  }),
  category_id: nullable(stringSchema("Assigned category ID")),
  favicon_url: nullable(stringSchema("Favicon URL", { format: "uri" })),
  screenshot_url: nullable(stringSchema("Screenshot URL", { format: "uri" })),
  is_pinned: integerSchema("Pinned flag, 0 or 1", { enum: [0, 1] }),
  is_archived: integerSchema("Archived flag, 0 or 1", { enum: [0, 1] }),
  is_trashed: integerSchema("Trash flag, 0 or 1", { enum: [0, 1] }),
  trashed_at: nullable(stringSchema("Trash timestamp", { format: "date-time" })),
  read_at: nullable(stringSchema("Read timestamp", { format: "date-time" })),
  notes: nullable(stringSchema("Personal notes")),
  created_at: stringSchema("Creation timestamp", { format: "date-time" }),
  updated_at: stringSchema("Update timestamp", { format: "date-time" }),
  tags: arrayOf(stringSchema("Tag name"), "Tag names attached to the bookmark"),
} as const;

const bookmarkRequired = [
  "id",
  "url",
  "domain",
  "title",
  "description",
  "status",
  "category_id",
  "favicon_url",
  "screenshot_url",
  "is_pinned",
  "is_archived",
  "is_trashed",
  "trashed_at",
  "read_at",
  "notes",
  "created_at",
  "updated_at",
  "tags",
] as const;

const schemas = {
  ProblemDetails: objectSchema(
    {
      type: stringSchema("Stable problem type URI"),
      title: stringSchema("Short human-readable error title"),
      status: integerSchema("HTTP status code"),
      detail: stringSchema("Human-readable explanation", { nullable: true }),
    },
    ["type", "title", "status"],
    "RFC 7807-style problem response"
  ),
  LegacyError: objectSchema(
    {
      error: stringSchema("Human-readable error message"),
      details: stringSchema("Optional additional details", { nullable: true }),
    },
    ["error"],
    "Legacy JSON error response"
  ),
  Pagination: objectSchema(
    {
      total: integerSchema("Total matching records", { minimum: 0 }),
      limit: integerSchema("Applied page size", { minimum: 0 }),
      offset: integerSchema("Applied offset", { minimum: 0 }),
      has_more: booleanSchema("Whether another page exists"),
    },
    ["total", "limit", "offset", "has_more"]
  ),
  Bookmark: objectSchema(bookmarkProperties, bookmarkRequired),
  BookmarkContent: objectSchema(
    {
      bookmark_id: stringSchema("Bookmark ID"),
      raw_html: nullable(stringSchema("Raw HTML")),
      markdown: nullable(stringSchema("Extracted Markdown")),
      summary: nullable(stringSchema("Extracted summary")),
      author: nullable(stringSchema("Author")),
      published_at: nullable(stringSchema("Published timestamp", { format: "date-time" })),
      word_count: nullable(integerSchema("Estimated word count", { minimum: 0 })),
      language: nullable(stringSchema("Detected language")),
      extracted_at: stringSchema("Extraction timestamp", { format: "date-time" }),
    },
    [
      "bookmark_id",
      "raw_html",
      "markdown",
      "summary",
      "author",
      "published_at",
      "word_count",
      "language",
      "extracted_at",
    ]
  ),
  BookmarkDetail: objectSchema(
    {
      ...bookmarkProperties,
      content: nullable(ref("BookmarkContent")),
    },
    [...bookmarkRequired, "content"],
    "Bookmark with extracted content"
  ),
  BookmarkDetailResponse: envelope(ref("BookmarkDetail"), "Single bookmark response"),
  BookmarkResponse: envelope(ref("Bookmark"), "Single bookmark response"),
  BookmarkListResponse: paginatedEnvelope(ref("Bookmark"), "Paginated bookmark list"),
  BookmarkArrayResponse: envelope(arrayOf(ref("Bookmark"), "Bookmarks"), "Bookmark array response"),
  BookmarkCreateRequest: objectSchema(
    {
      url: stringSchema("HTTP or HTTPS URL to save", { format: "uri" }),
      title: stringSchema("Optional title override"),
    },
    ["url"]
  ),
  BookmarkUpdateRequest: objectSchema({
    title: nullable(stringSchema("New title, or null to clear", { maxLength: 2000 })),
    category_id: nullable(stringSchema("Category ID, or null to clear")),
    tags: arrayOf(stringSchema("Tag name", { maxLength: 100 }), "Replacement tag names"),
    is_pinned: integerSchema("Pinned flag, 0 or 1"),
    is_archived: integerSchema("Archived flag, 0 or 1"),
    read_at: nullable(stringSchema("ISO 8601 date-time, or null to mark unread", { format: "date-time" })),
    notes: nullable(stringSchema("Personal notes, or null to clear", { maxLength: 100000 })),
  }),
  RelatedBookmarksResponse: envelope(arrayOf(ref("Bookmark"), "Related bookmarks")),
  BookmarkPipelineStatus: objectSchema(
    {
      bookmarkId: stringSchema("Bookmark ID"),
      bookmarkStatus: stringSchema("Current bookmark pipeline status", {
        enum: ["saved", "fetched", "extracted", "ai_enriched", "indexed"],
      }),
      job: nullable(
        objectSchema(
          {
            id: stringSchema("Job ID"),
            type: stringSchema("Job type"),
            status: stringSchema("Job status", { enum: ["pending", "running", "done", "failed"] }),
            error: nullable(stringSchema("Job error")),
            created_at: stringSchema("Job creation timestamp", { format: "date-time" }),
            started_at: nullable(stringSchema("Job start timestamp", { format: "date-time" })),
            finished_at: nullable(stringSchema("Job finish timestamp", { format: "date-time" })),
          },
          ["id", "type", "status", "error", "created_at", "started_at", "finished_at"]
        )
      ),
    },
    ["bookmarkId", "bookmarkStatus", "job"]
  ),
  BookmarkPipelineStatusResponse: envelope(ref("BookmarkPipelineStatus")),
  SearchResultItem: objectSchema(
    {
      ...bookmarkProperties,
      snippet: nullable(stringSchema("Highlighted search excerpt")),
      rank: nullable(numberSchema("Search rank or hybrid score")),
    },
    [...bookmarkRequired, "snippet", "rank"],
    "Bookmark search hit"
  ),
  SearchResponse: objectSchema(
    {
      data: arrayOf(ref("SearchResultItem"), "Search hits"),
      pagination: ref("Pagination"),
      meta: objectSchema({ mode: stringSchema("Applied search mode", { enum: ["keyword", "semantic", "hybrid"] }) }, [
        "mode",
      ]),
    },
    ["data", "pagination", "meta"]
  ),
  CategoryRecord: objectSchema(
    {
      id: stringSchema("Category ID"),
      name: stringSchema("Category name"),
      parent_id: nullable(stringSchema("Parent category ID")),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      updated_at: stringSchema("Update timestamp", { format: "date-time" }),
    },
    ["id", "name", "parent_id", "created_at", "updated_at"],
    "Category row returned by create and update endpoints"
  ),
  CategoryWithCount: objectSchema(
    {
      id: stringSchema("Category ID"),
      name: stringSchema("Category name"),
      parent_id: nullable(stringSchema("Parent category ID")),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      updated_at: stringSchema("Update timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Active bookmark count", { minimum: 0 }),
    },
    ["id", "name", "parent_id", "created_at", "updated_at", "bookmark_count"],
    "Category row with active bookmark count returned by category listings"
  ),
  CategoryNode: objectSchema(
    {
      id: stringSchema("Category ID"),
      name: stringSchema("Category name"),
      parent_id: nullable(stringSchema("Parent category ID")),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      updated_at: stringSchema("Update timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Active bookmark count", { minimum: 0 }),
      children: arrayOf(ref("CategoryNode"), "Child categories"),
    },
    ["id", "name", "parent_id", "created_at", "updated_at", "bookmark_count", "children"]
  ),
  CategoryRequest: objectSchema(
    {
      name: stringSchema("Category name", { maxLength: 100 }),
      parent_id: nullable(stringSchema("Parent category ID")),
    },
    ["name"]
  ),
  CategoryPatchRequest: objectSchema({
    name: stringSchema("Category name", { maxLength: 100 }),
    parent_id: nullable(stringSchema("Parent category ID")),
  }),
  CategoryTreeResponse: envelope(arrayOf(ref("CategoryNode"), "Category tree")),
  CategoryResponse: envelope(ref("CategoryRecord")),
  TagRecord: objectSchema(
    {
      id: stringSchema("Tag ID"),
      name: stringSchema("Tag name"),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
    },
    ["id", "name", "created_at"],
    "Tag row returned by create and attach endpoints"
  ),
  TagWithCount: objectSchema(
    {
      id: stringSchema("Tag ID"),
      name: stringSchema("Tag name"),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Active bookmark count", { minimum: 0 }),
    },
    ["id", "name", "created_at", "bookmark_count"],
    "Tag row with active bookmark count returned by tag listings"
  ),
  TagRequest: objectSchema({ name: stringSchema("Lowercase tag name", { maxLength: 50 }) }, ["name"]),
  TagListResponse: envelope(arrayOf(ref("TagWithCount"), "Tags")),
  TagResponse: envelope(ref("TagRecord")),
  Domain: objectSchema(
    {
      domain: stringSchema("Domain"),
      count: integerSchema("Active bookmark count", { minimum: 0 }),
    },
    ["domain", "count"]
  ),
  DomainListResponse: envelope(arrayOf(ref("Domain"), "Domains")),
  ImportSummary: objectSchema(
    {
      importId: stringSchema("Import ID for progress stream"),
      total: integerSchema("Parsed bookmark count", { minimum: 0 }),
      warnings: integerSchema("Parser warning count", { minimum: 0 }),
      progressUrl: stringSchema("SSE progress URL"),
    },
    ["importId", "total", "warnings", "progressUrl"]
  ),
  ImportSummaryResponse: envelope(ref("ImportSummary")),
  ImportProgressEvent: objectSchema(
    {
      queued: integerSchema("Queued bookmarks", { minimum: 0 }),
      skipped: integerSchema("Skipped bookmarks", { minimum: 0 }),
      total: integerSchema("Total parsed bookmarks", { minimum: 0 }),
      done: booleanSchema("Whether import processing is complete"),
      error: nullable(stringSchema("Background import error")),
    },
    ["queued", "skipped", "total", "done", "error"]
  ),
  RuntimeLlmCapability: objectSchema(
    {
      enabled: booleanSchema("Whether this runtime feature is usable"),
      provider: stringSchema("Resolved provider", {
        enum: ["openai", "ollama", "anthropic", "openrouter", "openai_compatible", "deepseek", "none"],
      }),
      model: nullable(stringSchema("Resolved model")),
      base_url: nullable(stringSchema("Resolved base URL", { format: "uri" })),
    },
    ["enabled", "provider", "model", "base_url"]
  ),
  RuntimeEmbeddingCapability: objectSchema(
    {
      enabled: booleanSchema("Whether this runtime feature is usable"),
      provider: stringSchema("Resolved embedding provider", {
        enum: ["openai", "ollama", "openai_compatible", "none"],
      }),
      model: nullable(stringSchema("Resolved model")),
      base_url: nullable(stringSchema("Resolved base URL", { format: "uri" })),
    },
    ["enabled", "provider", "model", "base_url"]
  ),
  RuntimeCapabilities: objectSchema(
    {
      llm: ref("RuntimeLlmCapability"),
      embeddings: ref("RuntimeEmbeddingCapability"),
      capabilities: objectSchema(
        {
          enrichment: booleanSchema("LLM enrichment available"),
          semantic_search: booleanSchema("Semantic search available"),
          related_bookmarks: booleanSchema("Related bookmarks available"),
          organization_agent: booleanSchema("Organization agent available"),
        },
        ["enrichment", "semantic_search", "related_bookmarks", "organization_agent"]
      ),
    },
    ["llm", "embeddings", "capabilities"]
  ),
  SettingsBackupSchedule: objectSchema(
    {
      enabled: booleanSchema("Enable scheduled snapshots"),
      cron: stringSchema("Five-part cron expression"),
      retention_count: integerSchema("Number of local snapshots to retain", { minimum: 1 }),
    },
    ["enabled", "cron", "retention_count"]
  ),
  Settings: objectSchema(
    {
      ai: objectSchema(
        {
          provider: stringSchema("LLM provider", {
            enum: ["openai", "ollama", "anthropic", "openrouter", "openai_compatible", "deepseek", "none"],
          }),
          openai: objectSchema(
            {
              api_key: stringSchema("Redacted OpenAI API key. Empty string means unset"),
              model: stringSchema("OpenAI chat model"),
            },
            ["api_key", "model"]
          ),
          ollama: objectSchema(
            {
              base_url: stringSchema("Ollama base URL", { format: "uri" }),
              model: stringSchema("Ollama model"),
            },
            ["base_url", "model"]
          ),
          anthropic: objectSchema(
            {
              api_key: stringSchema("Redacted Anthropic API key. Empty string means unset"),
              base_url: stringSchema("Anthropic API base URL", { format: "uri" }),
              model: stringSchema("Anthropic Messages API model"),
            },
            ["api_key", "base_url", "model"]
          ),
          openrouter: objectSchema(
            {
              api_key: stringSchema("Redacted OpenRouter API key. Empty string means unset"),
              base_url: stringSchema("OpenRouter OpenAI-compatible base URL", { format: "uri" }),
              model: stringSchema("OpenRouter model slug"),
            },
            ["api_key", "base_url", "model"]
          ),
          openai_compatible: objectSchema(
            {
              api_key: stringSchema("Redacted custom OpenAI-compatible API key. Empty string means unset"),
              base_url: stringSchema("Custom OpenAI-compatible chat base URL", { format: "uri" }),
              model: stringSchema("Custom OpenAI-compatible chat model"),
            },
            ["api_key", "base_url", "model"]
          ),
          deepseek: objectSchema(
            {
              api_key: stringSchema("Redacted DeepSeek API key. Empty string means unset"),
              base_url: stringSchema("DeepSeek OpenAI-compatible base URL", { format: "uri" }),
              model: stringSchema("DeepSeek chat model"),
            },
            ["api_key", "base_url", "model"]
          ),
          embeddings: objectSchema(
            {
              provider: stringSchema("Embedding provider", { enum: ["openai", "ollama", "openai_compatible"] }),
              model: stringSchema("Embedding model"),
              openai_compatible: objectSchema(
                {
                  api_key: stringSchema("Redacted custom OpenAI-compatible embedding API key. Empty string means unset"),
                  base_url: stringSchema("Custom OpenAI-compatible embeddings base URL", { format: "uri" }),
                  model: stringSchema("Custom OpenAI-compatible embedding model"),
                },
                ["api_key", "base_url", "model"]
              ),
            },
            ["provider", "model", "openai_compatible"]
          ),
        },
        [
          "provider",
          "openai",
          "ollama",
          "anthropic",
          "openrouter",
          "openai_compatible",
          "deepseek",
          "embeddings",
        ]
      ),
      app: objectSchema(
        {
          autostart: booleanSchema("Start daemon automatically"),
          theme: stringSchema("UI theme", { enum: ["light", "dark", "system"] }),
          lock: objectSchema(
            {
              enabled: booleanSchema("Whether app lock is enabled"),
              pin_hash: stringSchema("Redacted PIN hash. Empty string means unset"),
            },
            ["enabled", "pin_hash"]
          ),
        },
        ["autostart", "theme", "lock"]
      ),
      backup: objectSchema(
        {
          local: objectSchema(
            {
              destination_path: stringSchema("Absolute custom backup destination, or empty string for default"),
            },
            ["destination_path"]
          ),
          schedule: ref("SettingsBackupSchedule"),
          s3: objectSchema(
            {
              endpoint: stringSchema("S3-compatible endpoint URL, or empty string for AWS", { format: "uri" }),
              bucket: stringSchema("S3 bucket"),
              access_key: stringSchema("Redacted S3 access key. Empty string means unset"),
              secret_key: stringSchema("Redacted S3 secret key. Empty string means unset"),
              region: stringSchema("S3 region"),
              prefix: stringSchema("Object key prefix"),
            },
            ["endpoint", "bucket", "access_key", "secret_key", "region", "prefix"]
          ),
        },
        ["local", "schedule", "s3"]
      ),
      runtime: ref("RuntimeCapabilities"),
    },
    ["ai", "app", "backup", "runtime"]
  ),
  SettingsPatch: objectSchema({
    ai: objectSchema({
      provider: stringSchema("LLM provider", {
        enum: ["openai", "ollama", "anthropic", "openrouter", "openai_compatible", "deepseek", "none"],
      }),
      openai: objectSchema({
        api_key: stringSchema("OpenAI API key, empty string clears it"),
        model: stringSchema("OpenAI chat model"),
      }),
      ollama: objectSchema({
        base_url: stringSchema("Ollama base URL", { format: "uri" }),
        model: stringSchema("Ollama model"),
      }),
      anthropic: objectSchema({
        api_key: stringSchema("Anthropic API key, empty string clears it"),
        base_url: stringSchema("Anthropic API base URL", { format: "uri" }),
        model: stringSchema("Anthropic Messages API model"),
      }),
      openrouter: objectSchema({
        api_key: stringSchema("OpenRouter API key, empty string clears it"),
        base_url: stringSchema("OpenRouter OpenAI-compatible base URL", { format: "uri" }),
        model: stringSchema("OpenRouter model slug"),
      }),
      openai_compatible: objectSchema({
        api_key: stringSchema("Custom OpenAI-compatible API key, empty string clears it"),
        base_url: stringSchema("Custom OpenAI-compatible chat base URL", { format: "uri" }),
        model: stringSchema("Custom OpenAI-compatible chat model"),
      }),
      deepseek: objectSchema({
        api_key: stringSchema("DeepSeek API key, empty string clears it"),
        base_url: stringSchema("DeepSeek OpenAI-compatible base URL", { format: "uri" }),
        model: stringSchema("DeepSeek chat model"),
      }),
      embeddings: objectSchema({
        provider: stringSchema("Embedding provider", { enum: ["openai", "ollama", "openai_compatible"] }),
        model: stringSchema("Embedding model"),
        openai_compatible: objectSchema({
          api_key: stringSchema("Custom OpenAI-compatible embedding API key, empty string clears it"),
          base_url: stringSchema("Custom OpenAI-compatible embeddings base URL", { format: "uri" }),
          model: stringSchema("Custom OpenAI-compatible embedding model"),
        }),
      }),
    }),
    app: objectSchema({
      autostart: booleanSchema("Start daemon automatically"),
      theme: stringSchema("UI theme", { enum: ["light", "dark", "system"] }),
      lock: objectSchema({
        enabled: booleanSchema("Whether app lock is enabled"),
        pin_hash: stringSchema("PIN hash, empty string clears it"),
      }),
    }),
    backup: objectSchema({
      local: objectSchema({
        destination_path: stringSchema("Absolute custom backup destination, or empty string for default"),
      }),
      schedule: objectSchema({
        enabled: booleanSchema("Enable scheduled snapshots"),
        cron: stringSchema("Five-part cron expression"),
        retention_count: integerSchema("Number of local snapshots to retain", { minimum: 1 }),
      }),
      s3: objectSchema({
        endpoint: stringSchema("S3-compatible endpoint URL, or empty string for AWS", { format: "uri" }),
        bucket: stringSchema("S3 bucket"),
        access_key: stringSchema("S3 access key"),
        secret_key: stringSchema("S3 secret key"),
        region: stringSchema("S3 region"),
        prefix: stringSchema("Object key prefix"),
      }),
    }),
  }),
  SettingsResponse: envelope(ref("Settings")),
  ConnectivityTestResponse: objectSchema(
    {
      ok: booleanSchema("Whether the connectivity check succeeded"),
      error: stringSchema("Failure reason"),
      message: stringSchema("Success message"),
    },
    ["ok"]
  ),
  BackupSchedule: objectSchema(
    {
      enabled: booleanSchema("Enable scheduled snapshots"),
      cron: stringSchema("Five-part cron expression"),
      retention_count: integerSchema("Number of local snapshots to retain", { minimum: 1 }),
      next_run_at: nullable(stringSchema("Next scheduled run timestamp", { format: "date-time" })),
    },
    ["enabled", "cron", "retention_count", "next_run_at"]
  ),
  BackupSchedulePatch: objectSchema({
    enabled: booleanSchema("Enable scheduled snapshots"),
    cron: stringSchema("Five-part cron expression"),
    retention_count: integerSchema("Number of local snapshots to retain", { minimum: 1 }),
  }),
  BackupScheduleResponse: envelope(ref("BackupSchedule")),
  BackupDestination: objectSchema(
    {
      path: stringSchema("Effective backup directory"),
      is_custom: booleanSchema("Whether a custom destination is active"),
      writable: booleanSchema("Whether the daemon can write to this directory"),
    },
    ["path", "is_custom", "writable"]
  ),
  BackupDestinationPatch: objectSchema(
    {
      path: stringSchema("Absolute custom backup path, or empty string to reset"),
    },
    ["path"]
  ),
  BackupDestinationResponse: envelope(ref("BackupDestination")),
  BackupCreateRequest: objectSchema({
    skip_remote: booleanSchema("When true, create only the local snapshot and skip S3 upload"),
  }),
  BackupResult: objectSchema(
    {
      path: stringSchema("Local backup directory"),
      size_bytes: integerSchema("Snapshot database size", { minimum: 0 }),
      bookmark_count: integerSchema("Bookmarks included", { minimum: 0 }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      remote_url: stringSchema("Remote S3 URL when uploaded"),
    },
    ["path", "size_bytes", "bookmark_count", "created_at"]
  ),
  BackupEntry: objectSchema(
    {
      name: stringSchema("Backup name or remote key"),
      path: stringSchema("Local path or s3:// URI"),
      size_bytes: integerSchema("Snapshot database size", { minimum: 0 }),
      bookmark_count: integerSchema("Bookmarks included", { minimum: 0 }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      source: stringSchema("Backup source", { enum: ["local", "remote"] }),
    },
    ["name", "path", "size_bytes", "bookmark_count", "created_at", "source"]
  ),
  BackupListResponse: envelope(arrayOf(ref("BackupEntry"), "Backup entries")),
  BackupVerifyRequest: objectSchema(
    {
      name: stringSchema("Local backup directory name"),
    },
    ["name"]
  ),
  BackupVerificationResult: objectSchema(
    {
      ok: booleanSchema("Whether verification succeeded"),
      name: stringSchema("Local backup directory name"),
      path: stringSchema("Local backup directory"),
      checksum_verified: booleanSchema("Whether checksum verification succeeded"),
      verified_files: arrayOf(stringSchema("Verified backup file path relative to the backup directory"), "Verified files"),
      bookmark_count: integerSchema("Bookmarks included", { minimum: 0 }),
      created_at: stringSchema("Backup creation timestamp", { format: "date-time" }),
    },
    ["ok", "name", "path", "checksum_verified", "verified_files", "bookmark_count", "created_at"]
  ),
  RestoreRequest: objectSchema({
    name: stringSchema("Local backup directory name"),
    source: stringSchema("Restore source", { enum: ["remote"] }),
    key: stringSchema("Remote S3 snapshot.db key"),
    allow_unsafe_no_checksum: booleanSchema("Allow restoring a backup with no checksum file"),
  }),
  RestoreResult: objectSchema(
    {
      restored_at: stringSchema("Restore timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Restored bookmark count", { minimum: 0 }),
      checksum_verified: booleanSchema("Whether checksum verification succeeded"),
      rollback_path: stringSchema("Rollback copy directory"),
      restart_required: booleanSchema("Whether daemon restart is required"),
    },
    ["restored_at", "bookmark_count", "checksum_verified", "rollback_path", "restart_required"]
  ),
  TimelineEvent: objectSchema(
    {
      id: stringSchema("Timeline event ID"),
      type: stringSchema("Timeline event type", {
        enum: [
          "category_created",
          "category_merged",
          "category_merge_suggested",
          "category_renamed",
          "duplicate_removed",
          "duplicate_flagged",
          "cluster_labeled",
          "suggestion_accepted",
          "suggestion_rejected",
        ],
      }),
      description: stringSchema("Human-readable event description"),
      metadata: objectSchema({}, [] as const, "Event metadata", true),
      source: stringSchema("Event source", { enum: ["agent", "user"] }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
    },
    ["id", "type", "description", "metadata", "source", "created_at"]
  ),
  TimelinePage: objectSchema(
    {
      data: arrayOf(ref("TimelineEvent"), "Timeline events"),
      pagination: ref("Pagination"),
    },
    ["data", "pagination"]
  ),
  Suggestion: objectSchema(
    {
      id: stringSchema("Suggestion ID"),
      bookmarkId: nullable(stringSchema("Related bookmark ID")),
      type: stringSchema("Suggestion type", { enum: ["new_subcategory", "merge_categories", "duplicate_bookmark"] }),
      value: stringSchema("Human-readable suggestion value"),
      metadata: objectSchema({}, [] as const, "Suggestion metadata", true),
      confidence: nullable(numberSchema("Confidence score")),
      status: stringSchema("Suggestion status", { enum: ["pending", "accepted", "rejected"] }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      resolved_at: nullable(stringSchema("Resolution timestamp", { format: "date-time" })),
    },
    ["id", "bookmarkId", "type", "value", "metadata", "confidence", "status", "created_at", "resolved_at"]
  ),
  SuggestionsResponse: objectSchema(
    {
      data: arrayOf(ref("Suggestion"), "Pending suggestions"),
      meta: objectSchema({ pending: integerSchema("Pending suggestion count", { minimum: 0 }) }, ["pending"]),
    },
    ["data", "meta"]
  ),
  HealthResponse: objectSchema(
    {
      status: stringSchema("Health status", { enum: ["ok"] }),
      version: stringSchema("Daemon package version"),
      uptime: integerSchema("Process uptime in milliseconds", { minimum: 0 }),
      queueSize: integerSchema("Queued background jobs", { minimum: 0 }),
    },
    ["status", "version", "uptime", "queueSize"]
  ),
  ExportBookmark: objectSchema(
    {
      id: stringSchema("Bookmark ID"),
      url: stringSchema("Bookmark URL", { format: "uri" }),
      title: nullable(stringSchema("Title")),
      summary: nullable(stringSchema("Summary")),
      tags: arrayOf(stringSchema("Tag name"), "Tag names"),
      category: nullable(stringSchema("Category name")),
      domain: stringSchema("Domain"),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
    },
    ["id", "url", "title", "summary", "tags", "category", "domain", "created_at"]
  ),
  McpErrorResponse: objectSchema({ error: stringSchema("MCP failure message") }, ["error"]),
} as const satisfies ApiSchemaMap;

export const apiContract = {
  name: "Little Imp daemon API",
  version: "1",
  baseUrl: "http://127.0.0.1:3210",
  description: "Local-only REST and MCP API exposed by littleimpd.",
  schemas,
  routes: [
    {
      method: "GET",
      path: "/health",
      tag: "System",
      summary: "Return daemon health, version, uptime, and queue size.",
      responses: { "200": jsonResponse("Daemon health", ref("HealthResponse")) },
    },
    {
      method: "POST",
      path: "/bookmarks",
      tag: "Bookmarks",
      summary: "Save a URL and enqueue the ingestion pipeline.",
      request: { body: { contentType: "application/json", schema: ref("BookmarkCreateRequest") } },
      responses: {
        "200": jsonResponse("Existing active bookmark returned idempotently", ref("BookmarkResponse")),
        "201": jsonResponse("Bookmark created", ref("BookmarkResponse")),
        "400": problemResponse("Malformed JSON"),
        "409": problemResponse("URL already exists in trash or archive"),
        "422": problemResponse("Invalid URL or missing url field"),
      },
    },
    {
      method: "GET",
      path: "/bookmarks",
      tag: "Bookmarks",
      summary: "List active or archived bookmarks with filters and pagination.",
      request: {
        query: objectSchema({
          ...bookmarkFilters,
          ...pagingQuery.properties,
          archived: stringSchema("When true, return archived bookmarks", { enum: ["true", "false"] }),
        }),
      },
      responses: { "200": jsonResponse("Bookmark page", ref("BookmarkListResponse")) },
    },
    {
      method: "GET",
      path: "/bookmarks/:id",
      tag: "Bookmarks",
      summary: "Get one bookmark with extracted content.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Bookmark detail", ref("BookmarkDetailResponse")),
        "404": problemResponse("Bookmark not found"),
      },
    },
    {
      method: "PUT",
      path: "/bookmarks/:id",
      tag: "Bookmarks",
      summary: "Patch bookmark fields, tags, archive state, read state, and notes.",
      request: {
        pathParams: idParam(),
        body: { contentType: "application/json", schema: ref("BookmarkUpdateRequest") },
      },
      responses: {
        "200": jsonResponse("Updated bookmark", ref("BookmarkResponse")),
        "400": problemResponse("Malformed JSON"),
        "404": problemResponse("Bookmark not found"),
        "422": problemResponse("Invalid patch field"),
      },
    },
    {
      method: "DELETE",
      path: "/bookmarks/:id",
      tag: "Bookmarks",
      summary: "Soft-delete a bookmark by moving it to trash.",
      request: { pathParams: idParam() },
      responses: { "204": noContentResponse("Bookmark moved to trash"), "404": problemResponse("Bookmark not found") },
    },
    {
      method: "POST",
      path: "/bookmarks/:id/restore",
      tag: "Bookmarks",
      summary: "Restore a trashed bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Restored bookmark", ref("BookmarkResponse")),
        "404": problemResponse("Bookmark not found or not in trash"),
        "500": problemResponse("Restore succeeded but bookmark could not be fetched"),
      },
    },
    {
      method: "DELETE",
      path: "/bookmarks/:id/permanent",
      tag: "Bookmarks",
      summary: "Permanently delete a trashed bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "204": noContentResponse("Bookmark permanently deleted"),
        "404": problemResponse("Bookmark not found or not in trash"),
      },
    },
    {
      method: "GET",
      path: "/trash",
      tag: "Bookmarks",
      summary: "List trashed bookmarks.",
      responses: { "200": jsonResponse("Trashed bookmarks", ref("BookmarkArrayResponse")) },
    },
    {
      method: "GET",
      path: "/bookmarks/:id/related",
      tag: "Bookmarks",
      summary: "List semantically related bookmarks.",
      request: {
        pathParams: idParam(),
        query: objectSchema({ limit: integerSchema("Maximum related bookmarks", { minimum: 1, maximum: 50 }) }),
      },
      responses: {
        "200": jsonResponse("Related bookmarks", ref("RelatedBookmarksResponse")),
        "404": problemResponse("Bookmark not found"),
        "422": problemResponse("Embedding provider is not configured"),
      },
      examples: [
        {
          title: "List related bookmarks",
          request: 'curl "http://127.0.0.1:3210/bookmarks/bm_123/related?limit=5"',
        },
      ],
    },
    {
      method: "GET",
      path: "/bookmarks/:id/status",
      tag: "Bookmarks",
      summary: "Get latest pipeline job status for a bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Bookmark pipeline status", ref("BookmarkPipelineStatusResponse")),
        "404": problemResponse("Bookmark not found"),
      },
    },
    {
      method: "GET",
      path: "/search",
      tag: "Search",
      summary: "Search bookmarks by keyword, semantic, or hybrid mode.",
      request: {
        query: objectSchema({
          q: stringSchema("Search query"),
          mode: stringSchema("Search mode", { enum: ["keyword", "semantic", "hybrid"] }),
          ...bookmarkFilters,
          ...pagingQuery.properties,
        }),
      },
      responses: {
        "200": jsonResponse("Search page", ref("SearchResponse")),
        "400": problemResponse("Invalid FTS query syntax"),
        "422": problemResponse("Invalid mode or missing embedding configuration"),
      },
    },
    {
      method: "GET",
      path: "/categories",
      tag: "Categories",
      summary: "List categories as a tree with bookmark counts.",
      responses: { "200": jsonResponse("Category tree", ref("CategoryTreeResponse")) },
    },
    {
      method: "POST",
      path: "/categories",
      tag: "Categories",
      summary: "Create a category.",
      request: { body: { contentType: "application/json", schema: ref("CategoryRequest") } },
      responses: {
        "201": jsonResponse("Created category", ref("CategoryResponse")),
        "400": problemResponse("Malformed JSON"),
        "409": problemResponse("Duplicate category under parent"),
        "422": problemResponse("Invalid name or parent"),
      },
    },
    {
      method: "PUT",
      path: "/categories/:id",
      tag: "Categories",
      summary: "Rename or reparent a category.",
      request: {
        pathParams: idParam(),
        body: { contentType: "application/json", schema: ref("CategoryPatchRequest") },
      },
      responses: {
        "200": jsonResponse("Updated category", ref("CategoryResponse")),
        "400": problemResponse("Malformed JSON"),
        "404": problemResponse("Category not found"),
        "409": problemResponse("Duplicate category under parent"),
        "422": problemResponse("Invalid patch or parent"),
      },
    },
    {
      method: "DELETE",
      path: "/categories/:id",
      tag: "Categories",
      summary: "Delete a category.",
      request: { pathParams: idParam() },
      responses: { "204": noContentResponse("Category deleted"), "404": problemResponse("Category not found") },
    },
    {
      method: "GET",
      path: "/tags",
      tag: "Tags",
      summary: "List tags with bookmark counts.",
      responses: { "200": jsonResponse("Tags", ref("TagListResponse")) },
    },
    {
      method: "POST",
      path: "/tags",
      tag: "Tags",
      summary: "Create a tag, idempotently returning an existing tag when present.",
      request: { body: { contentType: "application/json", schema: ref("TagRequest") } },
      responses: {
        "200": jsonResponse("Existing tag", ref("TagResponse")),
        "201": jsonResponse("Created tag", ref("TagResponse")),
        "400": problemResponse("Malformed JSON"),
        "422": problemResponse("Invalid tag name"),
      },
    },
    {
      method: "DELETE",
      path: "/tags/:id",
      tag: "Tags",
      summary: "Delete a tag and detach it from bookmarks.",
      request: { pathParams: idParam() },
      responses: { "204": noContentResponse("Tag deleted"), "404": problemResponse("Tag not found") },
    },
    {
      method: "POST",
      path: "/bookmarks/:id/tags",
      tag: "Tags",
      summary: "Attach a tag to a bookmark.",
      request: {
        pathParams: idParam(),
        body: { contentType: "application/json", schema: ref("TagRequest") },
      },
      responses: {
        "201": jsonResponse("Bookmark with attached tag", ref("BookmarkResponse")),
        "400": problemResponse("Malformed JSON"),
        "404": problemResponse("Bookmark not found"),
        "422": problemResponse("Invalid tag name"),
      },
    },
    {
      method: "DELETE",
      path: "/bookmarks/:id/tags/:tagId",
      tag: "Tags",
      summary: "Detach a tag from a bookmark.",
      request: {
        pathParams: objectSchema(
          {
            id: stringSchema("Bookmark ID"),
            tagId: stringSchema("Tag ID"),
          },
          ["id", "tagId"]
        ),
      },
      responses: {
        "204": noContentResponse("Tag detached"),
        "404": problemResponse("Bookmark, tag, or attachment not found"),
      },
    },
    {
      method: "GET",
      path: "/domains",
      tag: "Domains",
      summary: "List domains with active bookmark counts.",
      responses: { "200": jsonResponse("Domains", ref("DomainListResponse")), "500": problemResponse("Query failed") },
    },
    {
      method: "POST",
      path: "/import",
      tag: "Import",
      summary: "Import a Netscape HTML bookmark export.",
      request: {
        body: {
          contentType: "multipart/form-data",
          description: "Multipart body with a file field containing a .html bookmark export.",
          schema: objectSchema({ file: stringSchema("HTML bookmark export file") }, ["file"]),
        },
      },
      responses: {
        "200": jsonResponse("Import accepted", ref("ImportSummaryResponse")),
        "400": problemResponse("Multipart parsing failed"),
        "413": problemResponse("File exceeds 10 MB"),
        "415": problemResponse("Request is not multipart/form-data"),
        "422": problemResponse("Missing file or invalid bookmark export"),
      },
    },
    {
      method: "GET",
      path: "/import/:importId/progress",
      tag: "Import",
      summary: "Stream import progress over Server-Sent Events.",
      request: { pathParams: idParam("importId") },
      responses: {
        "200": {
          description: "SSE stream of progress events",
          contentType: "text/event-stream",
          schema: ref("ImportProgressEvent"),
        },
        "404": problemResponse("Import ID not found"),
      },
    },
    {
      method: "GET",
      path: "/settings",
      tag: "Settings",
      summary: "Read current settings with secrets redacted and runtime capabilities.",
      responses: { "200": jsonResponse("Settings", ref("SettingsResponse")) },
    },
    {
      method: "PUT",
      path: "/settings",
      tag: "Settings",
      summary: "Deep-merge a settings patch into persisted settings.",
      request: { body: { contentType: "application/json", schema: ref("SettingsPatch") } },
      responses: {
        "200": jsonResponse("Updated settings", ref("SettingsResponse")),
        "400": problemResponse("Malformed JSON"),
        "422": problemResponse("Invalid settings patch"),
        "500": problemResponse("Settings could not be persisted"),
      },
    },
    {
      method: "POST",
      path: "/settings/test-ai",
      tag: "Settings",
      summary: "Test connectivity to the configured LLM provider.",
      responses: { "200": jsonResponse("Connectivity result", ref("ConnectivityTestResponse")) },
    },
    {
      method: "POST",
      path: "/backup",
      tag: "Backup",
      summary: "Create a local backup snapshot and optionally upload it to S3.",
      request: { body: { contentType: "application/json", schema: ref("BackupCreateRequest") } },
      responses: {
        "201": jsonResponse("Backup created", ref("BackupResult")),
        "400": legacyErrorResponse("Malformed or non-object JSON body"),
        "422": legacyErrorResponse("Invalid backup create request"),
        "409": legacyErrorResponse("Backup or restore already in progress"),
        "500": legacyErrorResponse("Backup creation failed"),
      },
    },
    {
      method: "GET",
      path: "/backup/list",
      tag: "Backup",
      summary: "List local backups and optionally merge remote S3 backups.",
      request: {
        query: objectSchema({
          include_remote: stringSchema("When true, include S3 backups", { enum: ["true", "false"] }),
        }),
      },
      responses: {
        "200": jsonResponse("Backups", ref("BackupListResponse")),
        "422": legacyErrorResponse("S3 is not configured"),
        "500": legacyErrorResponse("Remote backup listing failed"),
      },
    },
    {
      method: "GET",
      path: "/backup/schedule",
      tag: "Backup",
      summary: "Read backup schedule settings and the computed next run time.",
      responses: { "200": jsonResponse("Backup schedule", ref("BackupScheduleResponse")) },
    },
    {
      method: "PUT",
      path: "/backup/schedule",
      tag: "Backup",
      summary: "Patch backup schedule settings.",
      request: { body: { contentType: "application/json", schema: ref("BackupSchedulePatch") } },
      responses: {
        "200": jsonResponse("Updated backup schedule", ref("BackupScheduleResponse")),
        "400": legacyErrorResponse("Malformed or non-object JSON body"),
        "422": legacyErrorResponse("Invalid schedule patch"),
        "500": legacyErrorResponse("Schedule settings could not be saved"),
      },
      examples: [
        {
          title: "Update backup schedule",
          request:
            'curl -X PUT http://127.0.0.1:3210/backup/schedule \\\n  -H "Content-Type: application/json" \\\n  -d \'{"enabled":true,"cron":"0 3 * * *","retention_count":10}\'',
        },
      ],
    },
    {
      method: "GET",
      path: "/backup/destination",
      tag: "Backup",
      summary: "Read the effective backup directory and writability.",
      responses: { "200": jsonResponse("Backup destination", ref("BackupDestinationResponse")) },
    },
    {
      method: "PUT",
      path: "/backup/destination",
      tag: "Backup",
      summary: "Set or clear the custom local backup directory.",
      request: { body: { contentType: "application/json", schema: ref("BackupDestinationPatch") } },
      responses: {
        "200": jsonResponse("Updated backup destination", ref("BackupDestinationResponse")),
        "400": legacyErrorResponse("Malformed or non-object JSON body"),
        "422": legacyErrorResponse("Invalid or unwritable path"),
        "500": legacyErrorResponse("Destination settings could not be saved"),
      },
      examples: [
        {
          title: "Set a custom backup destination",
          request:
            'curl -X PUT http://127.0.0.1:3210/backup/destination \\\n  -H "Content-Type: application/json" \\\n  -d \'{"path":"/Users/me/Backups/Little Imp"}\'',
        },
      ],
    },
    {
      method: "POST",
      path: "/backup/verify",
      tag: "Backup",
      summary: "Verify a local backup snapshot without restoring it.",
      request: { body: { contentType: "application/json", schema: ref("BackupVerifyRequest") } },
      responses: {
        "200": jsonResponse("Backup verification result", ref("BackupVerificationResult")),
        "400": legacyErrorResponse("Malformed JSON"),
        "409": legacyErrorResponse("Backup or restore already in progress"),
        "422": legacyErrorResponse("Invalid verify request or backup validation failed"),
        "500": legacyErrorResponse("Backup verification failed"),
      },
      examples: [
        {
          title: "Verify a local backup",
          request:
            'curl -X POST http://127.0.0.1:3210/backup/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"2026-05-13T09-30-00-000Z"}\'',
        },
      ],
    },
    {
      method: "POST",
      path: "/restore",
      tag: "Backup",
      summary: "Restore from a local backup directory or remote S3 snapshot.",
      request: { body: { contentType: "application/json", schema: ref("RestoreRequest") } },
      responses: {
        "200": jsonResponse("Restore completed", ref("RestoreResult")),
        "400": legacyErrorResponse("Malformed JSON"),
        "409": legacyErrorResponse("Backup or restore already in progress"),
        "422": legacyErrorResponse("Invalid restore request or backup validation failed"),
        "500": legacyErrorResponse("Restore failed"),
      },
      examples: [
        {
          title: "Restore a local backup",
          request:
            'curl -X POST http://127.0.0.1:3210/restore \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"2026-05-13T09-30-00-000Z"}\'',
        },
        {
          title: "Restore a remote backup",
          request:
            'curl -X POST http://127.0.0.1:3210/restore \\\n  -H "Content-Type: application/json" \\\n  -d \'{"source":"remote","key":"little-imp/2026-05-13T09-30-00-000Z/snapshot.db"}\'',
        },
      ],
    },
    {
      method: "POST",
      path: "/settings/test-s3",
      tag: "Backup",
      summary: "Test connectivity to the configured S3 backup destination.",
      responses: {
        "200": jsonResponse("S3 connectivity succeeded", ref("ConnectivityTestResponse")),
        "422": legacyErrorResponse("S3 is not configured or connection failed"),
      },
      examples: [
        {
          title: "Test S3 connectivity",
          request: "curl -X POST http://127.0.0.1:3210/settings/test-s3",
        },
      ],
    },
    {
      method: "GET",
      path: "/timeline",
      tag: "Timeline",
      summary: "List timeline events with pagination.",
      request: { query: pagingQuery },
      responses: {
        "200": jsonResponse("Timeline page", ref("TimelinePage")),
        "400": problemResponse("Invalid limit or offset"),
      },
    },
    {
      method: "GET",
      path: "/suggestions",
      tag: "Suggestions",
      summary: "List pending organization-agent suggestions.",
      responses: { "200": jsonResponse("Pending suggestions", ref("SuggestionsResponse")) },
    },
    {
      method: "POST",
      path: "/suggestions/:id/accept",
      tag: "Suggestions",
      summary: "Accept a suggestion and apply its action.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Accepted suggestion", envelope(ref("Suggestion"))),
        "404": problemResponse("Suggestion not found"),
        "422": problemResponse("Suggestion is no longer pending or action is invalid"),
        "500": problemResponse("Suggestion action failed"),
      },
    },
    {
      method: "POST",
      path: "/suggestions/:id/reject",
      tag: "Suggestions",
      summary: "Reject a pending suggestion.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Rejected suggestion", envelope(ref("Suggestion"))),
        "404": problemResponse("Suggestion not found"),
        "422": problemResponse("Suggestion is no longer pending"),
        "500": problemResponse("Suggestion could not be resolved"),
      },
    },
    {
      method: "GET",
      path: "/export",
      tag: "Export",
      summary: "Export active bookmarks as JSON or CSV.",
      request: {
        query: objectSchema({
          format: stringSchema("Export format", { enum: ["json", "csv"] }),
          ...bookmarkFilters,
        }),
      },
      responses: {
        "200": {
          description: "Downloadable JSON or CSV export",
          contentType: "application/json or text/csv",
          schema: arrayOf(ref("ExportBookmark"), "Export rows"),
        },
        "400": legacyErrorResponse("Invalid format"),
      },
    },
    {
      method: "ALL",
      path: "/mcp",
      tag: "MCP",
      summary: "Handle MCP Streamable HTTP transport requests.",
      description: "The daemon creates a fresh MCP server and transport for each request.",
      responses: {
        "200": { description: "MCP transport response", contentType: "application/json or text/event-stream" },
        "500": jsonResponse("MCP request failed", ref("McpErrorResponse")),
      },
      examples: [
        {
          title: "Call the MCP endpoint",
          request:
            'curl -X POST http://127.0.0.1:3210/mcp \\\n  -H "Content-Type: application/json" \\\n  -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}\'',
        },
      ],
    },
  ],
} as const satisfies ApiContract;
