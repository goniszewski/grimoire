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
  category_id: stringSchema("Filter by exact category ID; takes precedence over category"),
  category: stringSchema("Filter by category name"),
  date_from: stringSchema("Inclusive ISO date or date-time lower bound"),
  date_to: stringSchema("Inclusive ISO date or date-time upper bound"),
  read_later: stringSchema("Filter by read-later state; accepts boolean strings or numeric flags", {
    enum: ["true", "false", "1", "0"],
  }),
  read_state: stringSchema("Filter by read state", { enum: ["read", "unread"] }),
  is_pinned: stringSchema("Filter by pinned/starred state; accepts boolean strings or numeric flags", {
    enum: ["true", "false", "1", "0"],
  }),
  opened_count_min: integerSchema("Filter to bookmarks opened at least this many times", { minimum: 0 }),
  opened_count_max: integerSchema("Filter to bookmarks opened no more than this many times", { minimum: 0 }),
  last_opened_from: stringSchema("Inclusive ISO date or date-time lower bound for last opened time"),
  last_opened_to: stringSchema("Inclusive ISO date or date-time upper bound for last opened time"),
};

const bookmarkSortQuery = {
  sort: stringSchema("Sort key applied before pagination", {
    enum: ["created_at", "updated_at", "title", "domain", "opened_count", "last_opened_at"],
  }),
  direction: stringSchema("Sort direction; requires sort and defaults to desc when omitted", {
    enum: ["asc", "desc"],
  }),
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
  favicon_url: nullable(stringSchema("Cached favicon media path or URL")),
  screenshot_url: nullable(stringSchema("Cached page preview media path or URL")),
  is_pinned: integerSchema("Pinned flag, 0 or 1; maps Grimoire starred/favorite state", { enum: [0, 1] }),
  is_archived: integerSchema("Archived flag, 0 or 1", { enum: [0, 1] }),
  is_trashed: integerSchema("Trash flag, 0 or 1", { enum: [0, 1] }),
  trashed_at: nullable(stringSchema("Trash timestamp", { format: "date-time" })),
  read_later: integerSchema("Read-later flag, 0 or 1", { enum: [0, 1] }),
  read_at: nullable(stringSchema("Read timestamp", { format: "date-time" })),
  opened_count: integerSchema("Number of user-triggered opens", { minimum: 0 }),
  last_opened_at: nullable(stringSchema("Most recent user-triggered open timestamp", { format: "date-time" })),
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
  "read_later",
  "read_at",
  "opened_count",
  "last_opened_at",
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
  BookmarkMedia: objectSchema(
    {
      id: stringSchema("Media cache record ID"),
      kind: stringSchema("Media kind", { enum: ["favicon", "screenshot", "image"] }),
      url: stringSchema("Local daemon media path"),
      source_url: stringSchema("Original media source URL", { format: "uri" }),
      media_type: stringSchema("Cached non-SVG image MIME type"),
      size_bytes: integerSchema("Cached media byte size", { minimum: 0 }),
      alt: nullable(stringSchema("Image alt text or preview label")),
    },
    ["id", "kind", "url", "source_url", "media_type", "size_bytes", "alt"],
    "Cached local media item"
  ),
  BookmarkMediaSet: objectSchema(
    {
      favicon: nullable(ref("BookmarkMedia")),
      screenshot: nullable(ref("BookmarkMedia")),
      images: arrayOf(ref("BookmarkMedia"), "Cached extracted images"),
    },
    ["favicon", "screenshot", "images"],
    "Cached local media available for a bookmark"
  ),
  BookmarkDetail: objectSchema(
    {
      ...bookmarkProperties,
      content: nullable(ref("BookmarkContent")),
      media: ref("BookmarkMediaSet"),
    },
    [...bookmarkRequired, "content", "media"],
    "Bookmark with extracted content"
  ),
  BookmarkDetailResponse: envelope(ref("BookmarkDetail"), "Single bookmark response"),
  BookmarkResponse: envelope(ref("Bookmark"), "Single bookmark response"),
  BookmarkListResponse: paginatedEnvelope(ref("Bookmark"), "Paginated bookmark list"),
  BookmarkArrayResponse: envelope(arrayOf(ref("Bookmark"), "Bookmarks"), "Bookmark array response"),
  BookmarkAggregateCategory: objectSchema(
    {
      id: stringSchema("Category ID"),
      name: stringSchema("Category name"),
      count: integerSchema("Matching active bookmark count", { minimum: 0 }),
    },
    ["id", "name", "count"],
    "Category aggregate count under the requested library filter context"
  ),
  BookmarkAggregateTag: objectSchema(
    {
      name: stringSchema("Tag name"),
      count: integerSchema("Matching active bookmark count", { minimum: 0 }),
    },
    ["name", "count"],
    "Tag aggregate count under the requested library filter context"
  ),
  BookmarkAggregateDomain: objectSchema(
    {
      domain: stringSchema("Domain"),
      count: integerSchema("Matching active bookmark count", { minimum: 0 }),
    },
    ["domain", "count"],
    "Domain aggregate count under the requested library filter context"
  ),
  BookmarkReadAggregate: objectSchema(
    {
      read: integerSchema("Matching active bookmarks marked read", { minimum: 0 }),
      unread: integerSchema("Matching active bookmarks not marked read", { minimum: 0 }),
    },
    ["read", "unread"],
    "Read state aggregate counts"
  ),
  BookmarkPinnedAggregate: objectSchema(
    {
      pinned: integerSchema("Matching active bookmarks pinned/starred", { minimum: 0 }),
      unpinned: integerSchema("Matching active bookmarks not pinned/starred", { minimum: 0 }),
    },
    ["pinned", "unpinned"],
    "Pinned/starred aggregate counts"
  ),
  BookmarkReadLaterAggregate: objectSchema(
    {
      yes: integerSchema("Matching active bookmarks marked read-later", { minimum: 0 }),
      no: integerSchema("Matching active bookmarks not marked read-later", { minimum: 0 }),
    },
    ["yes", "no"],
    "Read-later aggregate counts"
  ),
  BookmarkAggregates: objectSchema(
    {
      total: integerSchema("Total active bookmarks matching the requested library filter context", { minimum: 0 }),
      categories: arrayOf(ref("BookmarkAggregateCategory"), "Category counts"),
      tags: arrayOf(ref("BookmarkAggregateTag"), "Tag counts"),
      domains: arrayOf(ref("BookmarkAggregateDomain"), "Domain counts"),
      read: ref("BookmarkReadAggregate"),
      pinned: ref("BookmarkPinnedAggregate"),
      read_later: ref("BookmarkReadLaterAggregate"),
    },
    ["total", "categories", "tags", "domains", "read", "pinned", "read_later"],
    "Page-independent active-library aggregate counts"
  ),
  BookmarkAggregatesResponse: envelope(ref("BookmarkAggregates"), "Bookmark aggregate counts response"),
  BookmarkCreateRequest: objectSchema(
    {
      url: stringSchema("HTTP or HTTPS URL to save", { format: "uri" }),
      title: stringSchema("Optional title override"),
    },
    ["url"]
  ),
  CaptureSource: objectSchema(
    {
      client: nullable(stringSchema("Optional local integration client label", { maxLength: 80 })),
      source_url: nullable(stringSchema("Optional public HTTP or HTTPS page/context URL", { format: "uri", maxLength: 2000 })),
      referrer_url: nullable(stringSchema("Optional public HTTP or HTTPS referrer URL", { format: "uri", maxLength: 2000 })),
      selected_text: nullable(stringSchema("Optional selected text or short capture context", { maxLength: 10000 })),
    },
    [],
    "Optional metadata recorded for a local integration capture request"
  ),
  BookmarkCaptureMetadata: objectSchema(
    {
      bookmark_id: stringSchema("Captured bookmark ID"),
      source_client: nullable(stringSchema("Local integration client label")),
      source_url: nullable(stringSchema("Stored source/context URL", { format: "uri" })),
      referrer_url: nullable(stringSchema("Stored referrer URL", { format: "uri" })),
      selected_text: nullable(stringSchema("Stored selected text or capture context")),
      captured_at: stringSchema("First capture timestamp", { format: "date-time" }),
      updated_at: stringSchema("Most recent metadata update timestamp", { format: "date-time" }),
    },
    ["bookmark_id", "source_client", "source_url", "referrer_url", "selected_text", "captured_at", "updated_at"],
    "Stored local integration capture metadata"
  ),
  CaptureRequest: objectSchema(
    {
      url: stringSchema("HTTP or HTTPS URL to save", { format: "uri" }),
      title: stringSchema("Optional title override", { maxLength: 2000 }),
      tags: arrayOf(stringSchema("Normalized tag name", { maxLength: 50, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }), "Optional replacement tag names"),
      category_id: nullable(stringSchema("Existing category ID to assign")),
      category: stringSchema("Root category name to resolve or create when category_id is omitted", { maxLength: 100 }),
      notes: nullable(stringSchema("Personal notes, or null to leave empty", { maxLength: 100000 })),
      source: ref("CaptureSource"),
    },
    ["url"],
    "Protected one-click capture request for explicit local integrations"
  ),
  CaptureResult: objectSchema(
    {
      bookmark: ref("Bookmark"),
      capture: nullable(ref("BookmarkCaptureMetadata")),
      created: booleanSchema("Whether a new bookmark was created"),
      job_id: nullable(stringSchema("Queued ingest job ID for new bookmarks")),
    },
    ["bookmark", "capture", "created", "job_id"],
    "One-click capture result"
  ),
  CaptureResponse: envelope(ref("CaptureResult"), "One-click capture response"),
  BookmarkUpdateRequest: objectSchema({
    title: nullable(stringSchema("New title, or null to clear", { maxLength: 2000 })),
    category_id: nullable(stringSchema("Category ID, or null to clear")),
    tags: arrayOf(stringSchema("Tag name", { maxLength: 100 }), "Replacement tag names"),
    is_pinned: integerSchema("Pinned flag, 0 or 1; maps Grimoire starred/favorite state"),
    read_later: integerSchema("Read-later flag, 0 or 1"),
    is_archived: integerSchema("Archived flag, 0 or 1"),
    read_at: nullable(stringSchema("ISO 8601 date-time, or null to mark unread", { format: "date-time" })),
    notes: nullable(stringSchema("Personal notes, or null to clear", { maxLength: 100000 })),
  }),
  RelatedBookmarksResponse: envelope(arrayOf(ref("Bookmark"), "Related bookmarks")),
  PipelineFailure: objectSchema(
    {
      stage: stringSchema("Pipeline stage that last reported an actionable failure", {
        enum: ["fetch", "extract", "ai_enrich", "embed", "index"],
      }),
      message: stringSchema("Failure message safe to show in the local UI"),
      configuration_related: booleanSchema("Whether the failure likely requires provider settings"),
      retryable: booleanSchema("Whether retrying the bookmark pipeline is supported"),
      failed_at: stringSchema("Failure timestamp", { format: "date-time" }),
      dismissed_at: nullable(stringSchema("Dismissal timestamp", { format: "date-time" })),
    },
    ["stage", "message", "configuration_related", "retryable", "failed_at", "dismissed_at"],
    "Latest actionable pipeline failure for a bookmark"
  ),
  BookmarkPipelineStatus: objectSchema(
    {
      bookmarkId: stringSchema("Bookmark ID"),
      bookmarkStatus: stringSchema("Current bookmark pipeline status", {
        enum: ["saved", "fetched", "extracted", "ai_enriched", "indexed"],
      }),
      last_failure: nullable(ref("PipelineFailure")),
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
    ["bookmarkId", "bookmarkStatus", "last_failure", "job"]
  ),
  BookmarkPipelineStatusResponse: envelope(ref("BookmarkPipelineStatus")),
  ReprocessRequest: objectSchema(
    {
      mode: stringSchema("Reprocess mode", {
        enum: ["selected", "failed_only", "all", "embeddings_only"],
      }),
      bookmark_id: stringSchema("Bookmark ID required when mode is selected"),
      replace_ai_fields: booleanSchema(
        "When true, allow reprocessing to update AI-derived title, category, and tags; manual notes are never overwritten"
      ),
    },
    ["mode"]
  ),
  ReprocessBatch: objectSchema(
    {
      batch_id: stringSchema("Reprocess batch ID"),
      mode: stringSchema("Accepted reprocess mode", {
        enum: ["selected", "failed_only", "all", "embeddings_only"],
      }),
      requested: integerSchema("Target bookmarks considered", { minimum: 0 }),
      enqueued: integerSchema("Jobs enqueued", { minimum: 0 }),
      skipped: integerSchema("Bookmarks skipped because work is already queued or running", { minimum: 0 }),
      job_ids: arrayOf(stringSchema("Queued job ID"), "Queued job IDs"),
      status_url: nullable(stringSchema("Batch status URL when jobs were enqueued")),
    },
    ["batch_id", "mode", "requested", "enqueued", "skipped", "job_ids", "status_url"]
  ),
  ReprocessBatchResponse: envelope(ref("ReprocessBatch")),
  ReprocessBatchStatus: objectSchema(
    {
      batch_id: stringSchema("Reprocess batch ID"),
      total: integerSchema("Total jobs in the batch", { minimum: 0 }),
      pending: integerSchema("Pending jobs", { minimum: 0 }),
      running: integerSchema("Running jobs", { minimum: 0 }),
      done: integerSchema("Completed jobs", { minimum: 0 }),
      failed: integerSchema("Failed jobs", { minimum: 0 }),
    },
    ["batch_id", "total", "pending", "running", "done", "failed"]
  ),
  ReprocessBatchStatusResponse: envelope(ref("ReprocessBatchStatus")),
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
      color: nullable(stringSchema("Optional category hex color", { pattern: "^#[0-9a-fA-F]{6}$" })),
      icon: nullable(stringSchema("Optional lowercase icon token", { maxLength: 40, pattern: "^[a-z0-9][a-z0-9-]*$" })),
      description: nullable(stringSchema("Optional category description", { maxLength: 500 })),
      slug: nullable(stringSchema("Optional category slug", { maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })),
      is_archived: integerSchema("Archived metadata flag, 0 or 1", { enum: [0, 1] }),
      is_public: integerSchema("Public visibility metadata flag, 0 or 1; local metadata only and does not expose data", { enum: [0, 1] }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      updated_at: stringSchema("Update timestamp", { format: "date-time" }),
    },
    ["id", "name", "parent_id", "color", "icon", "description", "slug", "is_archived", "is_public", "created_at", "updated_at"],
    "Category row returned by create and update endpoints"
  ),
  CategoryWithCount: objectSchema(
    {
      id: stringSchema("Category ID"),
      name: stringSchema("Category name"),
      parent_id: nullable(stringSchema("Parent category ID")),
      color: nullable(stringSchema("Optional category hex color", { pattern: "^#[0-9a-fA-F]{6}$" })),
      icon: nullable(stringSchema("Optional lowercase icon token", { maxLength: 40, pattern: "^[a-z0-9][a-z0-9-]*$" })),
      description: nullable(stringSchema("Optional category description", { maxLength: 500 })),
      slug: nullable(stringSchema("Optional category slug", { maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })),
      is_archived: integerSchema("Archived metadata flag, 0 or 1", { enum: [0, 1] }),
      is_public: integerSchema("Public visibility metadata flag, 0 or 1; local metadata only and does not expose data", { enum: [0, 1] }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      updated_at: stringSchema("Update timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Active bookmark count", { minimum: 0 }),
    },
    ["id", "name", "parent_id", "color", "icon", "description", "slug", "is_archived", "is_public", "created_at", "updated_at", "bookmark_count"],
    "Category row with active bookmark count returned by category listings"
  ),
  CategoryNode: objectSchema(
    {
      id: stringSchema("Category ID"),
      name: stringSchema("Category name"),
      parent_id: nullable(stringSchema("Parent category ID")),
      color: nullable(stringSchema("Optional category hex color", { pattern: "^#[0-9a-fA-F]{6}$" })),
      icon: nullable(stringSchema("Optional lowercase icon token", { maxLength: 40, pattern: "^[a-z0-9][a-z0-9-]*$" })),
      description: nullable(stringSchema("Optional category description", { maxLength: 500 })),
      slug: nullable(stringSchema("Optional category slug", { maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })),
      is_archived: integerSchema("Archived metadata flag, 0 or 1", { enum: [0, 1] }),
      is_public: integerSchema("Public visibility metadata flag, 0 or 1; local metadata only and does not expose data", { enum: [0, 1] }),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      updated_at: stringSchema("Update timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Active bookmark count", { minimum: 0 }),
      children: arrayOf(ref("CategoryNode"), "Child categories"),
    },
    ["id", "name", "parent_id", "color", "icon", "description", "slug", "is_archived", "is_public", "created_at", "updated_at", "bookmark_count", "children"]
  ),
  CategoryRequest: objectSchema(
    {
      name: stringSchema("Category name", { maxLength: 100 }),
      parent_id: nullable(stringSchema("Parent category ID")),
      color: nullable(stringSchema("Optional category hex color", { pattern: "^#[0-9a-fA-F]{6}$" })),
      icon: nullable(stringSchema("Optional lowercase icon token", { maxLength: 40, pattern: "^[a-z0-9][a-z0-9-]*$" })),
      description: nullable(stringSchema("Optional category description", { maxLength: 500 })),
      slug: nullable(stringSchema("Optional category slug", { maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })),
      is_archived: integerSchema("Archived metadata flag, 0 or 1", { enum: [0, 1] }),
      is_public: integerSchema("Public visibility metadata flag, 0 or 1; local metadata only and does not expose data", { enum: [0, 1] }),
    },
    ["name"]
  ),
  CategoryPatchRequest: objectSchema({
    name: stringSchema("Category name", { maxLength: 100 }),
    parent_id: nullable(stringSchema("Parent category ID")),
    color: nullable(stringSchema("Optional category hex color", { pattern: "^#[0-9a-fA-F]{6}$" })),
    icon: nullable(stringSchema("Optional lowercase icon token", { maxLength: 40, pattern: "^[a-z0-9][a-z0-9-]*$" })),
    description: nullable(stringSchema("Optional category description", { maxLength: 500 })),
    slug: nullable(stringSchema("Optional category slug", { maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })),
    is_archived: integerSchema("Archived metadata flag, 0 or 1", { enum: [0, 1] }),
    is_public: integerSchema("Public visibility metadata flag, 0 or 1; local metadata only and does not expose data", { enum: [0, 1] }),
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
  TagRequest: objectSchema({ name: stringSchema("Tag name, normalized to lowercase", { maxLength: 50 }) }, ["name"]),
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
  ImportDuplicatePolicy: objectSchema(
    {
      active: stringSchema("Policy for active duplicate URLs", { enum: ["skip", "merge"] }),
      archived: stringSchema("Policy for archived duplicate URLs", { enum: ["skip", "restore_merge"] }),
      trashed: stringSchema("Policy for trashed duplicate URLs", { enum: ["skip", "restore_merge"] }),
    },
    ["active", "archived", "trashed"],
    "Duplicate handling policy applied to an import preview or commit"
  ),
  ImportFolderRemappingInput: objectSchema(
    {
      sourcePath: arrayOf(stringSchema("Source folder segment"), "Folder path from the imported file"),
      action: stringSchema("Folder remapping action. Use create with targetPath or existing with categoryId.", {
        enum: ["create", "existing"],
      }),
      categoryId: stringSchema("Existing category ID; required when action is existing"),
      targetPath: arrayOf(
        stringSchema("Target category path segment"),
        "Target path for create/reuse mappings. Child folders inherit remapped ancestor paths unless explicitly mapped."
      ),
    },
    ["sourcePath", "action"],
    "Import folder remapping request entry"
  ),
  ImportTagRemappingInput: objectSchema(
    {
      sourceTag: stringSchema("Source tag name from the imported file"),
      action: stringSchema("Tag remapping action. Use tagId for existing, targetName for new or renamed.", {
        enum: ["new", "existing", "renamed", "skipped"],
      }),
      tagId: stringSchema("Existing tag ID; required when action is existing"),
      targetName: stringSchema("Target tag name for new or renamed mappings; lowercase hyphen format, max 50 characters", {
        maxLength: 50,
        pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
      }),
    },
    ["sourceTag", "action"],
    "Import tag remapping request entry"
  ),
  ImportRemappingInput: objectSchema(
    {
      folders: arrayOf(ref("ImportFolderRemappingInput"), "Folder remapping overrides"),
      tags: arrayOf(ref("ImportTagRemappingInput"), "Tag remapping overrides"),
    },
    [],
    "Optional import remapping request JSON. Omitted folders and tags use the daemon's default create/reuse decisions."
  ),
  ImportFolderMapping: objectSchema(
    {
      sourcePath: arrayOf(stringSchema("Source folder segment"), "Folder path from the imported file"),
      action: stringSchema("Folder remapping action", { enum: ["create", "existing"] }),
      targetCategoryId: nullable(stringSchema("Existing target category ID when mapped to an existing category")),
      targetPath: arrayOf(stringSchema("Target category path segment"), "Resolved target category path"),
      status: stringSchema("Whether the target category path already exists or will be created", {
        enum: ["new", "existing"],
      }),
    },
    ["sourcePath", "action", "targetCategoryId", "targetPath", "status"],
    "Resolved import folder remapping decision"
  ),
  ImportTagMapping: objectSchema(
    {
      sourceTag: stringSchema("Source tag name from the imported file"),
      action: stringSchema("Tag remapping action", { enum: ["new", "existing", "renamed", "skipped"] }),
      targetTagId: nullable(stringSchema("Existing target tag ID when reused")),
      targetName: nullable(stringSchema("Resolved target tag name; null when skipped")),
      status: stringSchema("Whether the target tag exists, will be created, or is skipped", {
        enum: ["new", "existing", "skipped"],
      }),
    },
    ["sourceTag", "action", "targetTagId", "targetName", "status"],
    "Resolved import tag remapping decision"
  ),
  ImportRemapping: objectSchema(
    {
      folders: arrayOf(ref("ImportFolderMapping"), "Resolved folder remapping decisions"),
      tags: arrayOf(ref("ImportTagMapping"), "Resolved tag remapping decisions"),
    },
    ["folders", "tags"],
    "Resolved category and tag remapping decisions applied to an import preview or commit"
  ),
  ImportPreviewSummary: objectSchema(
    {
      totalRows: integerSchema("Total parsed bookmark rows, including skipped invalid/private rows", { minimum: 0 }),
      importableRows: integerSchema("Valid public HTTP(S) bookmark rows", { minimum: 0 }),
      new: integerSchema("Rows that would create new bookmarks", { minimum: 0 }),
      activeDuplicates: integerSchema("Rows matching active bookmarks", { minimum: 0 }),
      archivedDuplicates: integerSchema("Rows matching archived bookmarks", { minimum: 0 }),
      trashedDuplicates: integerSchema("Rows matching trashed bookmarks", { minimum: 0 }),
      invalidUrls: integerSchema("Rows skipped because the URL is malformed or not HTTP(S)", { minimum: 0 }),
      privateUrls: integerSchema("Rows skipped because the URL targets a private or loopback host", { minimum: 0 }),
      created: integerSchema("Estimated rows created under the selected policy", { minimum: 0 }),
      merged: integerSchema("Estimated active duplicate rows merged under the selected policy", { minimum: 0 }),
      restored: integerSchema("Estimated archived or trashed duplicate rows restored and merged", { minimum: 0 }),
      skipped: integerSchema("Estimated rows skipped under the selected policy", { minimum: 0 }),
    },
    [
      "totalRows",
      "importableRows",
      "new",
      "activeDuplicates",
      "archivedDuplicates",
      "trashedDuplicates",
      "invalidUrls",
      "privateUrls",
      "created",
      "merged",
      "restored",
      "skipped",
    ]
  ),
  ImportPreviewRow: objectSchema(
    {
      classification: stringSchema("Import row classification", {
        enum: ["new", "active_duplicate", "archived_duplicate", "trashed_duplicate", "invalid_url", "private_url"],
      }),
      action: stringSchema("Action that the selected policy would apply", {
        enum: ["create", "skip", "merge", "restore_merge"],
      }),
      url: nullable(stringSchema("Source bookmark URL")),
      title: stringSchema("Source bookmark title"),
      notes: nullable(stringSchema("Source note text when the import format provides note-like metadata")),
      tags: arrayOf(stringSchema("Source tag name"), "Source tag names"),
      targetTags: arrayOf(stringSchema("Mapped target tag name"), "Target tag names after remapping"),
      folders: arrayOf(stringSchema("Source folder name"), "Source folder path"),
      targetCategoryId: nullable(stringSchema("Mapped target category ID when it already exists")),
      targetCategoryPath: arrayOf(stringSchema("Mapped target category path segment"), "Target category path after remapping"),
      existingBookmarkId: nullable(stringSchema("Matching existing bookmark ID")),
      existingState: nullable(stringSchema("Matching existing bookmark state", { enum: ["active", "archived", "trashed"] })),
      skipReason: nullable(stringSchema("Reason the row would be skipped")),
    },
    [
      "classification",
      "action",
      "url",
      "title",
      "notes",
      "tags",
      "targetTags",
      "folders",
      "targetCategoryId",
      "targetCategoryPath",
      "existingBookmarkId",
      "existingState",
      "skipReason",
    ]
  ),
  ImportPreview: objectSchema(
    {
      duplicatePolicy: ref("ImportDuplicatePolicy"),
      remapping: ref("ImportRemapping"),
      summary: ref("ImportPreviewSummary"),
      folders: arrayOf(arrayOf(stringSchema("Folder segment"), "Folder path"), "Detected Netscape folder paths"),
      tags: arrayOf(stringSchema("Detected tag name"), "Detected tag names"),
      warnings: arrayOf(stringSchema("Parser warning"), "Parser warnings"),
      rows: arrayOf(ref("ImportPreviewRow"), "Preview rows"),
    },
    ["duplicatePolicy", "remapping", "summary", "folders", "tags", "warnings", "rows"],
    "Non-mutating import preview"
  ),
  ImportPreviewResponse: envelope(ref("ImportPreview")),
  ImportResultSummary: objectSchema(
    {
      totalRows: integerSchema("Total parsed bookmark rows, including skipped invalid/private rows", { minimum: 0 }),
      importableRows: integerSchema("Valid public HTTP(S) bookmark rows", { minimum: 0 }),
      created: integerSchema("Bookmarks created by the committed import", { minimum: 0 }),
      updated: integerSchema("Existing bookmarks updated by merge or restore actions", { minimum: 0 }),
      merged: integerSchema("Active duplicate bookmarks merged by the committed import", { minimum: 0 }),
      restored: integerSchema("Archived or trashed duplicate bookmarks restored and merged", { minimum: 0 }),
      skipped: integerSchema("Rows skipped by validation or duplicate policy", { minimum: 0 }),
      failed: integerSchema("Rows that failed during commit after import processing started", { minimum: 0 }),
      warnings: integerSchema("Parser and row-level warnings included in the result report", { minimum: 0 }),
      categoriesCreated: integerSchema("Categories created from imported folder paths", { minimum: 0 }),
      categoriesReused: integerSchema("Existing categories reused for imported folder paths", { minimum: 0 }),
    },
    [
      "totalRows",
      "importableRows",
      "created",
      "updated",
      "merged",
      "restored",
      "skipped",
      "failed",
      "warnings",
      "categoriesCreated",
      "categoriesReused",
    ],
    "Final committed import result counts"
  ),
  ImportResultRow: objectSchema(
    {
      status: stringSchema("Final committed row status", {
        enum: ["created", "merged", "restored", "skipped", "failed"],
      }),
      action: stringSchema("Requested action selected by the duplicate policy", {
        enum: ["create", "skip", "merge", "restore_merge"],
      }),
      classification: stringSchema("Import row classification", {
        enum: ["new", "active_duplicate", "archived_duplicate", "trashed_duplicate", "invalid_url", "private_url"],
      }),
      url: nullable(stringSchema("Source bookmark URL")),
      title: stringSchema("Source bookmark title"),
      notes: nullable(stringSchema("Source note text when the import format provides note-like metadata")),
      tags: arrayOf(stringSchema("Source tag name"), "Source tag names"),
      targetTags: arrayOf(stringSchema("Mapped target tag name"), "Target tag names after remapping"),
      folders: arrayOf(stringSchema("Source folder name"), "Source folder path"),
      targetCategoryId: nullable(stringSchema("Mapped target category ID when it already exists")),
      targetCategoryPath: arrayOf(stringSchema("Mapped target category path segment"), "Target category path after remapping"),
      existingBookmarkId: nullable(stringSchema("Matching existing bookmark ID from preview analysis")),
      bookmarkId: nullable(stringSchema("Bookmark ID created or updated by the committed import row")),
      skipReason: nullable(stringSchema("Reason the row was skipped")),
      warning: nullable(stringSchema("User-visible row warning, duplicate note, remapping note, or skipped-row reason")),
      error: nullable(stringSchema("User-visible row error when commit processing failed for this row")),
    },
    [
      "status",
      "action",
      "classification",
      "url",
      "title",
      "notes",
      "tags",
      "targetTags",
      "folders",
      "targetCategoryId",
      "targetCategoryPath",
      "existingBookmarkId",
      "bookmarkId",
      "skipReason",
      "warning",
      "error",
    ],
    "Final committed import row result"
  ),
  ImportResultReport: objectSchema(
    {
      duplicatePolicy: ref("ImportDuplicatePolicy"),
      remapping: ref("ImportRemapping"),
      summary: ref("ImportResultSummary"),
      warnings: arrayOf(stringSchema("Parser warning"), "Parser warnings"),
      rows: arrayOf(ref("ImportResultRow"), "Committed row results"),
    },
    ["duplicatePolicy", "remapping", "summary", "warnings", "rows"],
    "Final import result report available when progress is done"
  ),
  ImportSummary: objectSchema(
    {
      importId: stringSchema("Import ID for progress stream"),
      total: integerSchema("Parsed bookmark row count", { minimum: 0 }),
      folders: integerSchema("Parsed Netscape folder count", { minimum: 0 }),
      warnings: integerSchema("Parser warning count", { minimum: 0 }),
      duplicatePolicy: ref("ImportDuplicatePolicy"),
      remapping: ref("ImportRemapping"),
      progressUrl: stringSchema("SSE progress URL"),
    },
    ["importId", "total", "folders", "warnings", "duplicatePolicy", "remapping", "progressUrl"]
  ),
  ImportSummaryResponse: envelope(ref("ImportSummary")),
  ImportProgressEvent: objectSchema(
    {
      queued: integerSchema("Queued bookmarks", { minimum: 0 }),
      skipped: integerSchema("Skipped bookmarks", { minimum: 0 }),
      merged: integerSchema("Existing active bookmarks merged", { minimum: 0 }),
      restored: integerSchema("Existing archived or trashed bookmarks restored and merged", { minimum: 0 }),
      failed: integerSchema("Rows that failed during commit after import processing started", { minimum: 0 }),
      total: integerSchema("Total parsed bookmarks", { minimum: 0 }),
      folders: integerSchema("Total parsed Netscape folders", { minimum: 0 }),
      categoriesCreated: integerSchema("Categories created from imported folder paths", { minimum: 0 }),
      categoriesReused: integerSchema("Existing categories reused for imported folder paths", { minimum: 0 }),
      done: booleanSchema("Whether import processing is complete"),
      error: nullable(stringSchema("Background import error")),
      result: nullable(ref("ImportResultReport")),
    },
    [
      "queued",
      "skipped",
      "merged",
      "restored",
      "failed",
      "total",
      "folders",
      "categoriesCreated",
      "categoriesReused",
      "done",
      "error",
      "result",
    ]
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
  BackupPackageRequest: objectSchema(
    {
      name: stringSchema("Local backup directory name"),
      password: stringSchema("Password used to encrypt the package"),
    },
    ["name", "password"]
  ),
  EncryptedBackupPackageRequest: objectSchema(
    {
      path: stringSchema("Absolute path to an encrypted backup package file accessible by the daemon"),
      password: stringSchema("Password used to decrypt the package"),
    },
    ["path", "password"]
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
  EncryptedBackupPackageResult: objectSchema(
    {
      path: stringSchema("Encrypted package file path"),
      source_path: stringSchema("Source local backup directory"),
      encrypted: booleanSchema("Whether the package is encrypted"),
      size_bytes: integerSchema("Encrypted package size", { minimum: 0 }),
      created_at: stringSchema("Package creation timestamp", { format: "date-time" }),
    },
    ["path", "source_path", "encrypted", "size_bytes", "created_at"]
  ),
  EncryptedBackupPackageVerificationResult: objectSchema(
    {
      ok: booleanSchema("Whether verification succeeded"),
      path: stringSchema("Encrypted package file path"),
      package_encrypted: booleanSchema("Whether the verified input was encrypted"),
      checksum_verified: booleanSchema("Whether checksum verification succeeded after decryption"),
      verified_files: arrayOf(stringSchema("Verified backup file path relative to the package archive"), "Verified files"),
      bookmark_count: integerSchema("Bookmarks included", { minimum: 0 }),
      created_at: stringSchema("Backup creation timestamp", { format: "date-time" }),
    },
    ["ok", "path", "package_encrypted", "checksum_verified", "verified_files", "bookmark_count", "created_at"]
  ),
  RestoreRequest: objectSchema({
    name: stringSchema("Local backup directory name"),
    source: stringSchema("Restore source", { enum: ["remote", "encrypted_package"] }),
    key: stringSchema("Remote S3 snapshot.db key"),
    path: stringSchema("Absolute path to an encrypted backup package file accessible by the daemon"),
    password: stringSchema("Password used to decrypt the encrypted package"),
    allow_unsafe_no_checksum: booleanSchema("Allow restoring a backup with no checksum file"),
  }),
  RestoreResult: objectSchema(
    {
      restored_at: stringSchema("Restore timestamp", { format: "date-time" }),
      bookmark_count: integerSchema("Restored bookmark count", { minimum: 0 }),
      checksum_verified: booleanSchema("Whether checksum verification succeeded"),
      rollback_path: stringSchema("Rollback copy directory"),
      restart_required: booleanSchema("Whether daemon restart is required"),
      restart_command: stringSchema("Platform-specific command for restarting littleimpd when detectable"),
      health_url: stringSchema("Local health endpoint to poll after restarting the daemon"),
      rollback_instructions: arrayOf(stringSchema("Rollback recovery instruction"), "Manual rollback instructions"),
    },
    [
      "restored_at",
      "bookmark_count",
      "checksum_verified",
      "rollback_path",
      "restart_required",
      "restart_command",
      "health_url",
      "rollback_instructions",
    ]
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
          "category_reparented",
          "category_deleted",
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
  Diagnostics: objectSchema(
    {
      generated_at: stringSchema("Diagnostics generation timestamp", { format: "date-time" }),
      version: stringSchema("Daemon package version"),
      platform: objectSchema(
        {
          os: stringSchema("Operating system platform"),
          arch: stringSchema("CPU architecture"),
          bun_version: stringSchema("Bun runtime version"),
          node_env: stringSchema("Node environment"),
          host: stringSchema("Configured daemon bind host"),
          port: integerSchema("Configured daemon port", { minimum: 1, maximum: 65535 }),
        },
        ["os", "arch", "bun_version", "node_env", "host", "port"]
      ),
      install: objectSchema(
        {
          mode: stringSchema("Detected install mode", { enum: ["development", "native", "docker"] }),
        },
        ["mode"]
      ),
      paths: objectSchema(
        {
          data_dir: stringSchema("Configured data directory"),
          database_path: stringSchema("SQLite database path"),
          config_file: stringSchema("Runtime settings file path"),
          backup_dir: stringSchema("Effective local backup directory"),
          frontend_dist: nullable(stringSchema("Static frontend directory when served by the daemon")),
          log_files: arrayOf(
            objectSchema(
              {
                label: stringSchema("Log file label"),
                path: stringSchema("Log file path"),
              },
              ["label", "path"]
            ),
            "Known local daemon log files"
          ),
        },
        ["data_dir", "database_path", "config_file", "backup_dir", "frontend_dist", "log_files"]
      ),
      daemon: objectSchema(
        {
          status: stringSchema("Daemon status", { enum: ["ok"] }),
          uptime_ms: integerSchema("Process uptime in milliseconds", { minimum: 0 }),
          queue_size: integerSchema("Pending background jobs", { minimum: 0 }),
          queue: objectSchema(
            {
              pending: integerSchema("Pending jobs", { minimum: 0 }),
              running: integerSchema("Running jobs", { minimum: 0 }),
              done: integerSchema("Completed jobs retained in the queue table", { minimum: 0 }),
              failed: integerSchema("Failed jobs retained in the queue table", { minimum: 0 }),
            },
            ["pending", "running", "done", "failed"]
          ),
        },
        ["status", "uptime_ms", "queue_size", "queue"]
      ),
      providers: objectSchema(
        {
          llm: objectSchema(
            {
              provider: stringSchema("Selected LLM provider"),
              configured: booleanSchema("Whether LLM enrichment can run with current settings"),
              model: nullable(stringSchema("Resolved or selected LLM model")),
              base_url: nullable(
                stringSchema("Resolved or selected LLM base URL with credentials, query strings, and fragments removed", {
                  format: "uri",
                })
              ),
            },
            ["provider", "configured", "model", "base_url"]
          ),
          embeddings: objectSchema(
            {
              provider: stringSchema("Selected embedding provider"),
              configured: booleanSchema("Whether embedding-backed features can run with current settings"),
              model: nullable(stringSchema("Resolved or selected embedding model")),
              base_url: nullable(
                stringSchema(
                  "Resolved or selected embedding base URL with credentials, query strings, and fragments removed",
                  { format: "uri" }
                )
              ),
            },
            ["provider", "configured", "model", "base_url"]
          ),
        },
        ["llm", "embeddings"]
      ),
      backup: objectSchema(
        {
          local: objectSchema(
            {
              path: stringSchema("Effective local backup directory"),
              is_custom: booleanSchema("Whether a custom backup destination is active"),
              writable: booleanSchema("Whether the effective local backup directory is writable"),
            },
            ["path", "is_custom", "writable"]
          ),
          schedule: ref("BackupSchedule"),
          s3: objectSchema(
            {
              configured: booleanSchema("Whether enough non-secret S3 fields and stored credentials are present"),
              endpoint: stringSchema(
                "S3-compatible endpoint URL with credentials, query strings, and fragments removed; empty string for AWS",
                { format: "uri" }
              ),
              bucket: stringSchema("S3 bucket"),
              region: stringSchema("S3 region"),
              prefix: stringSchema("Object key prefix"),
            },
            ["configured", "endpoint", "bucket", "region", "prefix"]
          ),
        },
        ["local", "schedule", "s3"]
      ),
      search: objectSchema(
        {
          keyword: booleanSchema("Whether keyword search is available"),
          semantic: booleanSchema("Whether semantic search is available"),
          hybrid: booleanSchema("Whether hybrid search is available"),
        },
        ["keyword", "semantic", "hybrid"]
      ),
      omitted_secrets: arrayOf(
        stringSchema("Secret class or sensitive URL component intentionally omitted from diagnostics"),
        "Omitted secret classes"
      ),
    },
    [
      "generated_at",
      "version",
      "platform",
      "install",
      "paths",
      "daemon",
      "providers",
      "backup",
      "search",
      "omitted_secrets",
    ],
    "Redacted local diagnostics payload for user-shared support bundles"
  ),
  DiagnosticsResponse: envelope(ref("Diagnostics")),
  UpdateRelease: objectSchema(
    {
      version: stringSchema("Normalized semantic version"),
      tag: stringSchema("Release tag from the update source"),
      name: stringSchema("Release display name"),
      prerelease: booleanSchema("Whether the release is marked as a prerelease"),
      published_at: stringSchema("Release publication timestamp", { format: "date-time" }),
      url: stringSchema("Human-readable release URL", { format: "uri" }),
    },
    ["version", "tag", "name", "prerelease", "published_at", "url"]
  ),
  UpdateCheckResult: objectSchema(
    {
      current_version: stringSchema("Current packaged Little Imp version"),
      update_available: booleanSchema("Whether a compatible release is newer than the current version"),
      source: stringSchema("Release source URL used for the check", { format: "uri" }),
      channel: stringSchema("Applied update channel", { enum: ["stable", "beta"] }),
      latest: nullable(ref("UpdateRelease")),
    },
    ["current_version", "update_available", "source", "channel", "latest"]
  ),
  UpdateCheckResponse: envelope(ref("UpdateCheckResult")),
  ExportBookmark: objectSchema(
    {
      id: stringSchema("Bookmark ID"),
      url: stringSchema("Bookmark URL", { format: "uri" }),
      title: nullable(stringSchema("Title")),
      summary: nullable(stringSchema("Summary")),
      tags: arrayOf(stringSchema("Tag name"), "Tag names"),
      category: nullable(stringSchema("Category name")),
      domain: stringSchema("Domain"),
      is_pinned: integerSchema("Pinned flag, 0 or 1; maps Grimoire starred/favorite state", { enum: [0, 1] }),
      read_later: integerSchema("Read-later flag, 0 or 1", { enum: [0, 1] }),
      opened_count: integerSchema("Number of user-triggered opens", { minimum: 0 }),
      last_opened_at: nullable(stringSchema("Most recent user-triggered open timestamp", { format: "date-time" })),
      created_at: stringSchema("Creation timestamp", { format: "date-time" }),
      is_archived: integerSchema("Archived flag, 0 or 1; /export currently returns active rows, so emitted rows are 0", { enum: [0, 1] }),
      read_at: nullable(stringSchema("Read timestamp; null means unread", { format: "date-time" })),
      notes: nullable(stringSchema("Personal notes; null when empty")),
    },
    [
      "id",
      "url",
      "title",
      "summary",
      "tags",
      "category",
      "domain",
      "is_pinned",
      "read_later",
      "opened_count",
      "last_opened_at",
      "created_at",
      "is_archived",
      "read_at",
      "notes",
    ]
  ),
  IntegrationTokenRecord: objectSchema(
    {
      id: stringSchema("Integration token ID"),
      name: stringSchema("User-visible integration client name"),
      token_prefix: stringSchema("Redacted token prefix for display and support"),
      created_at: stringSchema("Token creation timestamp", { format: "date-time" }),
      last_used_at: nullable(stringSchema("Most recent successful token use timestamp", { format: "date-time" })),
      revoked_at: nullable(stringSchema("Token revocation timestamp", { format: "date-time" })),
    },
    ["id", "name", "token_prefix", "created_at", "last_used_at", "revoked_at"],
    "Managed local integration token metadata. Full bearer token values are returned only at creation or rotation."
  ),
  IntegrationTokenCreateRequest: objectSchema({
    name: stringSchema("User-visible integration client name", { maxLength: 120 }),
  }),
  IntegrationTokenCreateResult: objectSchema(
    {
      token: stringSchema("Full bearer token. Store it now; it is never returned by list endpoints."),
      record: ref("IntegrationTokenRecord"),
    },
    ["token", "record"],
    "One-time integration token creation or rotation result"
  ),
  IntegrationTokenCreateResponse: envelope(ref("IntegrationTokenCreateResult"), "Integration token creation response"),
  IntegrationTokenListResponse: envelope(arrayOf(ref("IntegrationTokenRecord"), "Integration token records")),
  McpErrorResponse: objectSchema({ error: stringSchema("MCP failure message") }, ["error"]),
  DemoLoadResult: envelope(
    objectSchema(
      {
        bookmarks_created: integerSchema("Number of bookmarks created by the demo load", { minimum: 0 }),
        categories_created: integerSchema("Number of categories created by the demo load", { minimum: 0 }),
      },
      ["bookmarks_created", "categories_created"]
    ),
    "Demo data load result"
  ),
} as const satisfies ApiSchemaMap;

const exampleTimestamp = "2026-06-01T09:30:00.000Z";
const exampleBookmark = {
  id: "bm_123",
  url: "https://example.com/rag-vector-search",
  domain: "example.com",
  title: "RAG Vector Search Notes",
  description: "Practical notes about vector search for retrieval augmented generation.",
  status: "indexed",
  category_id: "cat_ai",
  favicon_url: "/media/bookmarks/bm_123/favicon",
  screenshot_url: "/media/bookmarks/bm_123/screenshot",
  is_pinned: 0,
  is_archived: 0,
  is_trashed: 0,
  trashed_at: null,
  read_later: 1,
  read_at: null,
  opened_count: 2,
  last_opened_at: "2026-06-01T08:45:00.000Z",
  notes: "Compare chunking guidance with local notes.",
  created_at: exampleTimestamp,
  updated_at: exampleTimestamp,
  tags: ["rag", "search"],
} as const;

const exampleCreatedBookmark = {
  ...exampleBookmark,
  title: "RAG Vector Search Notes",
  description: null,
  status: "saved",
  category_id: null,
  favicon_url: null,
  screenshot_url: null,
  read_later: 0,
  opened_count: 0,
  last_opened_at: null,
  notes: null,
  tags: [],
} as const;

const exampleCaptureMetadata = {
  bookmark_id: "bm_123",
  source_client: "local-capture",
  source_url: "https://example.com/rag-vector-search",
  referrer_url: "https://example.com/",
  selected_text: "Hybrid retrieval combines exact and semantic matching.",
  captured_at: exampleTimestamp,
  updated_at: exampleTimestamp,
} as const;

const exampleCaptureResult = {
  bookmark: {
    ...exampleCreatedBookmark,
    title: "RAG Vector Search Notes",
    category_id: "cat_ai",
    notes: "Compare chunking guidance with local notes.",
    tags: ["rag", "search"],
  },
  capture: exampleCaptureMetadata,
  created: true,
  job_id: "job_123",
} as const;

const exampleBookmarkDetail = {
  ...exampleBookmark,
  content: {
    bookmark_id: "bm_123",
    raw_html: null,
    markdown: "## RAG Vector Search\n\nUse hybrid retrieval when exact terms matter.",
    summary: "A practical walkthrough of hybrid retrieval for RAG systems.",
    author: "Example Author",
    published_at: "2026-05-28T12:00:00.000Z",
    word_count: 1240,
    language: "en",
    extracted_at: exampleTimestamp,
  },
  media: {
    favicon: null,
    screenshot: null,
    images: [],
  },
} as const;

const examplePagination = {
  total: 1,
  limit: 10,
  offset: 0,
  has_more: false,
} as const;

const exampleBookmarkAggregates = {
  total: 12,
  categories: [
    { id: "cat_ai", name: "AI Research", count: 7 },
    { id: "cat_docs", name: "Documentation", count: 5 },
  ],
  tags: [
    { name: "rag", count: 6 },
    { name: "typescript", count: 4 },
  ],
  domains: [
    { domain: "example.com", count: 8 },
    { domain: "docs.example.com", count: 4 },
  ],
  read: { read: 3, unread: 9 },
  pinned: { pinned: 2, unpinned: 10 },
  read_later: { yes: 5, no: 7 },
} as const;

const exampleCategory = {
  id: "cat_ai",
  name: "AI Research",
  parent_id: null,
  color: "#2563eb",
  icon: "brain",
  description: "Papers, implementation notes, and reference material for AI work.",
  slug: "ai-research",
  is_archived: 0,
  is_public: 0,
  created_at: exampleTimestamp,
  updated_at: exampleTimestamp,
} as const;

const exampleCategoryNode = {
  ...exampleCategory,
  bookmark_count: 1,
  children: [],
} as const;

const exampleTag = {
  id: "tag_rag",
  name: "rag",
  created_at: exampleTimestamp,
} as const;

const exampleTagWithCount = {
  ...exampleTag,
  bookmark_count: 1,
} as const;

const exampleIntegrationToken = {
  id: "itok_123",
  name: "Raycast MCP",
  token_prefix: "limp_it_7fd9",
  created_at: exampleTimestamp,
  last_used_at: null,
  revoked_at: null,
} as const;

const problem = (type: string, title: string, status: number, detail: string) =>
  ({
    type,
    title,
    status,
    detail,
  }) as const;

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
      method: "GET",
      path: "/diagnostics",
      tag: "System",
      summary: "Return a redacted local diagnostics bundle for support.",
      description:
        "Diagnostics are generated locally and omit API keys, URL credentials, query strings, PIN hashes, S3 credentials, and backup passwords.",
      responses: { "200": jsonResponse("Redacted diagnostics", ref("DiagnosticsResponse")) },
      examples: [
        {
          title: "Generate diagnostics",
          request: "curl http://127.0.0.1:3210/diagnostics",
        },
      ],
    },
    {
      method: "GET",
      path: "/updates/check",
      tag: "Updates",
      summary: "Check a GitHub Releases-compatible source for a newer Little Imp release.",
      request: {
        query: objectSchema({
          channel: stringSchema("Update channel to check; defaults from the current package version", {
            enum: ["stable", "beta"],
          }),
          source: stringSchema(
            "Public GitHub Releases-compatible JSON endpoint; private and loopback hosts are rejected",
            { format: "uri" }
          ),
        }),
      },
      responses: {
        "200": jsonResponse("Update check result", ref("UpdateCheckResponse")),
        "422": problemResponse("Invalid channel or source URL"),
        "502": problemResponse("Update source could not be read or returned an invalid response"),
      },
      examples: [
        {
          title: "Check for updates",
          request: "curl 'http://127.0.0.1:3210/updates/check?channel=stable'",
        },
      ],
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
      examples: [
        {
          title: "Save a bookmark",
          request:
            'curl -X POST http://127.0.0.1:3210/bookmarks \\\n  -H "Content-Type: application/json" \\\n  -d \'{"url":"https://example.com/rag-vector-search","title":"RAG Vector Search Notes"}\'',
          response: {
            status: 201,
            contentType: "application/json",
            body: { data: exampleCreatedBookmark },
          },
        },
        {
          title: "Reject an invalid bookmark URL",
          request:
            'curl -X POST http://127.0.0.1:3210/bookmarks \\\n  -H "Content-Type: application/json" \\\n  -d \'{"url":"http://127.0.0.1/private"}\'',
          response: {
            status: 422,
            contentType: "application/problem+json",
            body: problem(
              "https://littleimp.app/problems/unprocessable-entity",
              "Unprocessable Entity",
              422,
              "Invalid URL - must be http or https"
            ),
          },
        },
      ],
    },
    {
      method: "GET",
      path: "/bookmarks",
      tag: "Bookmarks",
      summary: "List active or archived bookmarks with filters and pagination.",
      request: {
        query: objectSchema({
          ...bookmarkFilters,
          ...bookmarkSortQuery,
          ...pagingQuery.properties,
          archived: stringSchema("When true, return archived bookmarks", { enum: ["true", "false"] }),
        }),
      },
      responses: { "200": jsonResponse("Bookmark page", ref("BookmarkListResponse")) },
      examples: [
        {
          title: "List filtered bookmarks",
          request:
            'curl "http://127.0.0.1:3210/bookmarks?tag=rag&read_state=unread&is_pinned=true&opened_count_min=1&sort=opened_count&direction=desc&limit=10&offset=0"',
          response: {
            status: 200,
            contentType: "application/json",
            body: {
              data: [exampleBookmark],
              pagination: examplePagination,
            },
          },
        },
      ],
    },
    {
      method: "GET",
      path: "/bookmarks/aggregates",
      tag: "Bookmarks",
      summary: "Return page-independent active-library aggregate counts.",
      description:
        "Counts categories, tags, domains, read state, pinned/starred state, and read-later state for active bookmarks under the same approved library filter context as bookmark listing. Pagination and sorting are intentionally ignored.",
      request: {
        query: objectSchema({
          ...bookmarkFilters,
        }),
      },
      responses: {
        "200": jsonResponse("Bookmark aggregate counts", ref("BookmarkAggregatesResponse")),
        "422": problemResponse("Invalid aggregate filter"),
      },
      examples: [
        {
          title: "Read library aggregate counts",
          request:
            'curl "http://127.0.0.1:3210/bookmarks/aggregates?read_later=true&is_pinned=false"',
          response: {
            status: 200,
            contentType: "application/json",
            body: { data: exampleBookmarkAggregates },
          },
        },
      ],
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
      examples: [
        {
          title: "Read bookmark detail",
          request: "curl http://127.0.0.1:3210/bookmarks/bm_123",
          response: {
            status: 200,
            contentType: "application/json",
            body: { data: exampleBookmarkDetail },
          },
        },
      ],
    },
    {
      method: "GET",
      path: "/media/bookmarks/:bookmarkId/:mediaId",
      tag: "Bookmarks",
      summary: "Serve one cached local bookmark media file.",
      description:
        "Media files are served from the local cache only. Missing files, trashed bookmarks, and unknown media IDs return 404.",
      request: {
        pathParams: objectSchema(
          {
            bookmarkId: stringSchema("Bookmark ID"),
            mediaId: stringSchema("Media cache record ID"),
          },
          ["bookmarkId", "mediaId"]
        ),
      },
      responses: {
        "200": {
          description: "Cached non-SVG image media file",
          contentType: "image/*",
        },
        "404": problemResponse("Media not found"),
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
      examples: [
        {
          title: "Update bookmark metadata",
          request:
            'curl -X PUT http://127.0.0.1:3210/bookmarks/bm_123 \\\n  -H "Content-Type: application/json" \\\n  -d \'{"tags":["rag","retrieval"],"read_later":1,"notes":"Compare with local chunking notes."}\'',
          response: {
            status: 200,
            contentType: "application/json",
            body: {
              data: {
                ...exampleBookmark,
                tags: ["rag", "retrieval"],
                notes: "Compare with local chunking notes.",
              },
            },
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/bookmarks/:id/open",
      tag: "Bookmarks",
      summary: "Record a user-triggered external open for a bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Updated bookmark open metrics", ref("BookmarkResponse")),
        "404": problemResponse("Bookmark not found"),
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
      summary: "Get latest pipeline job and failure status for a bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Bookmark pipeline status", ref("BookmarkPipelineStatusResponse")),
        "404": problemResponse("Bookmark not found"),
      },
    },
    {
      method: "POST",
      path: "/bookmarks/:id/retry",
      tag: "Reprocess",
      summary: "Retry pipeline work for one bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "202": jsonResponse("Selected bookmark retry accepted", ref("ReprocessBatchResponse")),
        "404": problemResponse("Bookmark not found"),
      },
    },
    {
      method: "POST",
      path: "/bookmarks/:id/failure/dismiss",
      tag: "Bookmarks",
      summary: "Dismiss the current non-blocking pipeline failure for a bookmark.",
      request: { pathParams: idParam() },
      responses: {
        "204": noContentResponse("Pipeline failure dismissed"),
        "404": problemResponse("Bookmark not found"),
        "409": problemResponse("Blocking pipeline failure cannot be dismissed"),
      },
    },
    {
      method: "POST",
      path: "/bookmarks/reprocess",
      tag: "Reprocess",
      summary: "Enqueue durable reprocess or re-embed jobs for existing bookmarks.",
      request: { body: { contentType: "application/json", schema: ref("ReprocessRequest") } },
      responses: {
        "202": jsonResponse("Reprocess batch accepted", ref("ReprocessBatchResponse")),
        "400": problemResponse("Malformed JSON"),
        "404": problemResponse("Selected bookmark not found"),
        "422": problemResponse("Invalid reprocess request"),
      },
      examples: [
        {
          title: "Retry failed pipeline work",
          request:
            'curl -X POST http://127.0.0.1:3210/bookmarks/reprocess \\\n  -H "Content-Type: application/json" \\\n  -d \'{"mode":"failed_only"}\'',
        },
      ],
    },
    {
      method: "GET",
      path: "/reprocess/:batchId",
      tag: "Reprocess",
      summary: "Return progress counts for a durable reprocess batch.",
      request: { pathParams: idParam("batchId") },
      responses: {
        "200": jsonResponse("Reprocess batch status", ref("ReprocessBatchStatusResponse")),
        "404": problemResponse("Reprocess batch not found"),
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
          ...bookmarkSortQuery,
          ...pagingQuery.properties,
        }),
      },
      responses: {
        "200": jsonResponse("Search page", ref("SearchResponse")),
        "400": problemResponse("Invalid FTS query syntax"),
        "422": problemResponse("Invalid mode or missing embedding configuration"),
      },
      examples: [
        {
          title: "Hybrid search with pagination",
          request:
            'curl "http://127.0.0.1:3210/search?q=vector%20search&mode=hybrid&tag=rag&read_state=read&last_opened_from=2026-06-01&limit=10&offset=0"',
          response: {
            status: 200,
            contentType: "application/json",
            body: {
              data: [
                {
                  ...exampleBookmark,
                  snippet: "Use hybrid retrieval when exact vector search terms matter.",
                  rank: 0.93,
                },
              ],
              pagination: examplePagination,
              meta: { mode: "hybrid" },
            },
          },
        },
      ],
    },
    {
      method: "GET",
      path: "/categories",
      tag: "Categories",
      summary: "List categories as a tree with bookmark counts.",
      responses: { "200": jsonResponse("Category tree", ref("CategoryTreeResponse")) },
      examples: [
        {
          title: "List category tree",
          request: "curl http://127.0.0.1:3210/categories",
          response: {
            status: 200,
            contentType: "application/json",
            body: { data: [exampleCategoryNode] },
          },
        },
      ],
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
      examples: [
        {
          title: "Create a category with metadata",
          request:
            'curl -X POST http://127.0.0.1:3210/categories \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"AI Research","color":"#2563eb","icon":"brain","slug":"ai-research","description":"Papers, implementation notes, and reference material for AI work.","is_public":0}\'',
          response: {
            status: 201,
            contentType: "application/json",
            body: { data: exampleCategory },
          },
        },
      ],
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
      examples: [
        {
          title: "List tags",
          request: "curl http://127.0.0.1:3210/tags",
          response: {
            status: 200,
            contentType: "application/json",
            body: { data: [exampleTagWithCount] },
          },
        },
      ],
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
      examples: [
        {
          title: "Create a tag",
          request:
            'curl -X POST http://127.0.0.1:3210/tags \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"rag"}\'',
          response: {
            status: 201,
            contentType: "application/json",
            body: { data: exampleTag },
          },
        },
      ],
    },
    {
      method: "PUT",
      path: "/tags/:id",
      tag: "Tags",
      summary: "Rename a tag without changing bookmark associations.",
      description: "Duplicate target tag names are rejected with 409 rather than merged implicitly.",
      request: {
        pathParams: idParam(),
        body: { contentType: "application/json", schema: ref("TagRequest") },
      },
      responses: {
        "200": jsonResponse("Renamed tag", ref("TagResponse")),
        "400": problemResponse("Malformed JSON"),
        "404": problemResponse("Tag not found"),
        "409": problemResponse("Duplicate tag name"),
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
      path: "/import/preview",
      tag: "Import",
      summary: "Preview a Netscape HTML bookmark export without mutating library data.",
      request: {
        body: {
          contentType: "multipart/form-data",
          description: "Multipart body with a file field plus optional duplicatePolicy JSON and remapping JSON fields.",
          schema: objectSchema(
            {
              file: stringSchema("HTML bookmark export file"),
              duplicatePolicy: stringSchema("Optional JSON duplicate policy"),
              remapping: stringSchema(
                "Optional JSON ImportRemappingInput. Folder create mappings use sourcePath and targetPath; folder existing mappings use sourcePath and categoryId. Tag existing mappings use sourceTag and tagId; new/renamed mappings use sourceTag and targetName; skipped mappings use only sourceTag."
              ),
            },
            ["file"]
          ),
        },
      },
      responses: {
        "200": jsonResponse("Import preview", ref("ImportPreviewResponse")),
        "400": problemResponse("Multipart parsing failed"),
        "413": problemResponse("File exceeds 10 MB"),
        "415": problemResponse("Request is not multipart/form-data"),
        "422": problemResponse("Missing file, invalid bookmark export, or invalid duplicate policy"),
      },
      examples: [
        {
          title: "Preview Netscape bookmarks",
          request:
            "curl -X POST http://127.0.0.1:3210/import/preview \\\n  -F file=@bookmarks.html \\\n  -F 'duplicatePolicy={\"active\":\"merge\",\"archived\":\"restore_merge\",\"trashed\":\"skip\"}' \\\n  -F 'remapping={\"folders\":[{\"sourcePath\":[\"Research\"],\"action\":\"existing\",\"categoryId\":\"cat_research\"}],\"tags\":[{\"sourceTag\":\"sqlite\",\"action\":\"renamed\",\"targetName\":\"database\"}]}'",
          response: {
            status: 200,
            contentType: "application/json",
            body: {
              data: {
                duplicatePolicy: {
                  active: "merge",
                  archived: "restore_merge",
                  trashed: "skip",
                },
                remapping: {
                  folders: [
                    {
                      sourcePath: ["Research"],
                      action: "existing",
                      targetCategoryId: "cat_research",
                      targetPath: ["Research"],
                      status: "existing",
                    },
                  ],
                  tags: [
                    {
                      sourceTag: "database",
                      action: "existing",
                      targetTagId: "tag_database",
                      targetName: "database",
                      status: "existing",
                    },
                    {
                      sourceTag: "sqlite",
                      action: "renamed",
                      targetTagId: "tag_database",
                      targetName: "database",
                      status: "existing",
                    },
                  ],
                },
                summary: {
                  totalRows: 12,
                  importableRows: 10,
                  new: 7,
                  activeDuplicates: 1,
                  archivedDuplicates: 1,
                  trashedDuplicates: 1,
                  invalidUrls: 1,
                  privateUrls: 1,
                  created: 7,
                  merged: 1,
                  restored: 1,
                  skipped: 3,
                },
                folders: [["Research"], ["Research", "Databases"]],
                tags: ["database", "sqlite"],
                warnings: ["Skipped private/internal URL: http://127.0.0.1/admin"],
                rows: [
                  {
                    classification: "active_duplicate",
                    action: "merge",
                    url: "https://example.com/rag-vector-search",
                    title: "RAG Vector Search Notes",
                    notes: null,
                    tags: ["database"],
                    targetTags: ["database"],
                    folders: ["Research"],
                    targetCategoryId: "cat_research",
                    targetCategoryPath: ["Research"],
                    existingBookmarkId: "bm_123",
                    existingState: "active",
                    skipReason: null,
                  },
                ],
              },
            },
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/import",
      tag: "Import",
      summary: "Import a Netscape HTML bookmark export.",
      request: {
        body: {
          contentType: "multipart/form-data",
          description: "Multipart body with a file field plus optional duplicatePolicy JSON and remapping JSON fields.",
          schema: objectSchema(
            {
              file: stringSchema("HTML bookmark export file"),
              duplicatePolicy: stringSchema("Optional JSON duplicate policy"),
              remapping: stringSchema(
                "Optional JSON ImportRemappingInput. Folder create mappings use sourcePath and targetPath; folder existing mappings use sourcePath and categoryId. Tag existing mappings use sourceTag and tagId; new/renamed mappings use sourceTag and targetName; skipped mappings use only sourceTag."
              ),
            },
            ["file"]
          ),
        },
      },
      responses: {
        "200": jsonResponse("Import accepted", ref("ImportSummaryResponse")),
        "400": problemResponse("Multipart parsing failed"),
        "413": problemResponse("File exceeds 10 MB"),
        "415": problemResponse("Request is not multipart/form-data"),
        "422": problemResponse("Missing file or invalid bookmark export"),
      },
      examples: [
        {
          title: "Import Netscape bookmarks",
          request:
            "curl -X POST http://127.0.0.1:3210/import \\\n  -F file=@bookmarks.html \\\n  -F 'remapping={\"folders\":[{\"sourcePath\":[\"Research\"],\"action\":\"existing\",\"categoryId\":\"cat_research\"}],\"tags\":[{\"sourceTag\":\"sqlite\",\"action\":\"renamed\",\"targetName\":\"database\"}]}'",
          response: {
            status: 200,
            contentType: "application/json",
            body: {
              data: {
                importId: "import_123",
                total: 12,
                folders: 4,
                warnings: 1,
                duplicatePolicy: {
                  active: "skip",
                  archived: "skip",
                  trashed: "skip",
                },
                remapping: {
                  folders: [
                    {
                      sourcePath: ["Research"],
                      action: "existing",
                      targetCategoryId: "cat_research",
                      targetPath: ["Research"],
                      status: "existing",
                    },
                  ],
                  tags: [
                    {
                      sourceTag: "sqlite",
                      action: "renamed",
                      targetTagId: null,
                      targetName: "database",
                      status: "new",
                    },
                  ],
                },
                progressUrl: "/import/import_123/progress",
              },
            },
          },
        },
      ],
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
      examples: [
        {
          title: "Create a local backup",
          request:
            'curl -X POST http://127.0.0.1:3210/backup \\\n  -H "Content-Type: application/json" \\\n  -d \'{"skip_remote":true}\'',
          response: {
            status: 201,
            contentType: "application/json",
            body: {
              path: "/Users/me/.local/share/littleimp/backups/2026-06-01T09-30-00-000Z",
              size_bytes: 98304,
              bookmark_count: 42,
              created_at: exampleTimestamp,
            },
          },
        },
      ],
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
        "400": legacyErrorResponse("Malformed JSON or non-object request body"),
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
      path: "/backup/package",
      tag: "Backup",
      summary: "Create an encrypted package file from a local backup snapshot.",
      request: { body: { contentType: "application/json", schema: ref("BackupPackageRequest") } },
      responses: {
        "201": jsonResponse("Encrypted backup package created", ref("EncryptedBackupPackageResult")),
        "400": legacyErrorResponse("Malformed JSON or non-object request body"),
        "409": legacyErrorResponse("Backup or restore already in progress"),
        "422": legacyErrorResponse("Invalid package request or backup validation failed"),
        "500": legacyErrorResponse("Encrypted backup package creation failed"),
      },
      examples: [
        {
          title: "Create an encrypted package",
          request:
            'curl -X POST http://127.0.0.1:3210/backup/package \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"2026-05-13T09-30-00-000Z","password":"correct horse battery staple"}\'',
        },
      ],
    },
    {
      method: "POST",
      path: "/backup/package/verify",
      tag: "Backup",
      summary: "Verify an encrypted package file without restoring it.",
      request: { body: { contentType: "application/json", schema: ref("EncryptedBackupPackageRequest") } },
      responses: {
        "200": jsonResponse("Encrypted backup package verification result", ref("EncryptedBackupPackageVerificationResult")),
        "400": legacyErrorResponse("Malformed JSON or non-object request body"),
        "409": legacyErrorResponse("Backup or restore already in progress"),
        "422": legacyErrorResponse("Invalid package request, wrong password, or package validation failed"),
        "500": legacyErrorResponse("Encrypted backup package verification failed"),
      },
      examples: [
        {
          title: "Verify an encrypted package",
          request:
            'curl -X POST http://127.0.0.1:3210/backup/package/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"path":"/Users/me/Library/Application Support/littleimp/backups/2026-05-13T09-30-00-000Z.littleimp-backup.enc","password":"correct horse battery staple"}\'',
        },
      ],
    },
    {
      method: "POST",
      path: "/restore",
      tag: "Backup",
      summary: "Restore from a local backup directory, remote S3 snapshot, or encrypted package.",
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
        {
          title: "Restore an encrypted package",
          request:
            'curl -X POST http://127.0.0.1:3210/restore \\\n  -H "Content-Type: application/json" \\\n  -d \'{"source":"encrypted_package","path":"/Users/me/Library/Application Support/littleimp/backups/2026-05-13T09-30-00-000Z.littleimp-backup.enc","password":"correct horse battery staple"}\'',
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
        "422": legacyErrorResponse("Invalid export filter"),
      },
      examples: [
        {
          title: "Export read-later bookmarks as JSON",
          request: 'curl "http://127.0.0.1:3210/export?format=json&read_later=true"',
          response: {
            status: 200,
            contentType: "application/json",
            body: [
              {
                id: exampleBookmark.id,
                url: exampleBookmark.url,
                title: exampleBookmark.title,
                summary: "A practical walkthrough of hybrid retrieval for RAG systems.",
                tags: exampleBookmark.tags,
                category: exampleCategory.name,
                domain: exampleBookmark.domain,
                is_pinned: exampleBookmark.is_pinned,
                read_later: exampleBookmark.read_later,
                opened_count: exampleBookmark.opened_count,
                last_opened_at: exampleBookmark.last_opened_at,
                created_at: exampleBookmark.created_at,
                is_archived: exampleBookmark.is_archived,
                read_at: exampleBookmark.read_at,
                notes: exampleBookmark.notes,
              },
            ],
          },
        },
        {
          title: "Export read pinned bookmarks opened this month",
          request:
            'curl "http://127.0.0.1:3210/export?format=csv&read_state=read&is_pinned=true&opened_count_min=1&last_opened_from=2026-06-01"',
        },
        {
          title: "Reject an invalid export filter",
          request: 'curl "http://127.0.0.1:3210/export?format=json&read_state=maybe"',
          response: {
            status: 422,
            contentType: "application/json",
            body: { error: "`read_state` must be read or unread" },
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/capture",
      tag: "Integrations",
      summary: "Capture a bookmark from an explicit local integration.",
      description:
        "This protected local integration endpoint requires `Authorization: Bearer <integration-token>`. It creates a normal bookmark, optionally applies tags, notes, category assignment, and capture metadata, then enqueues the standard ingestion pipeline. Existing active URLs are returned idempotently without merging metadata or queueing duplicate work.",
      request: { body: { contentType: "application/json", schema: ref("CaptureRequest") } },
      responses: {
        "200": jsonResponse("Existing active bookmark returned idempotently", ref("CaptureResponse")),
        "201": jsonResponse("Bookmark captured and ingest queued", ref("CaptureResponse")),
        "400": problemResponse("Malformed JSON"),
        "401": problemResponse("Missing, invalid, rotated, or revoked integration token"),
        "409": problemResponse("URL already exists in trash or archive"),
        "413": legacyErrorResponse("Request body exceeds local JSON limit"),
        "422": problemResponse("Invalid capture request"),
      },
      examples: [
        {
          title: "Capture a bookmark from a local integration",
          request:
            'curl -X POST http://127.0.0.1:3210/capture \\\n  -H "Authorization: Bearer limp_it_example" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"url":"https://example.com/rag-vector-search","title":"RAG Vector Search Notes","tags":["rag","search"],"category":"AI Research","notes":"Compare chunking guidance with local notes.","source":{"client":"local-capture","source_url":"https://example.com/rag-vector-search","referrer_url":"https://example.com/","selected_text":"Hybrid retrieval combines exact and semantic matching."}}\'',
          response: {
            status: 201,
            contentType: "application/json",
            body: { data: exampleCaptureResult },
          },
        },
      ],
    },
    {
      method: "GET",
      path: "/capture/bookmarklet",
      tag: "Integrations",
      summary: "Bookmarklet capture page (hidden iframe target, no auth header).",
      description:
        "The browser bookmarklet uses a hidden iframe pointed at this endpoint to avoid CORS. Authentication is via a query-parameter token. The endpoint returns an HTML page (not JSON) that the iframe renders silently. Designed for the Settings → Browser Integration bookmarklet flow; not intended for direct use.",
      request: {
        query: objectSchema({
          token: stringSchema("Integration bearer token (query-param auth)"),
          url: stringSchema("The URL to capture"),
          title: stringSchema("Page title"),
          selection: stringSchema("User-selected text"),
        }, ["token", "url"]),
      },
      responses: {
        "200": { description: "Bookmark already exists (not duplicated)" },
        "201": { description: "Bookmark captured successfully" },
        "400": problemResponse("Missing token or url"),
        "401": problemResponse("Invalid or revoked token"),
        "409": problemResponse("URL exists in trash or archive"),
        "422": problemResponse("Invalid URL"),
      },
    },
    {
      method: "GET",
      path: "/integration-tokens",
      tag: "Integrations",
      summary: "List managed local integration tokens with secret values redacted.",
      responses: { "200": jsonResponse("Integration tokens", ref("IntegrationTokenListResponse")) },
      examples: [
        {
          title: "List integration tokens",
          request: "curl http://127.0.0.1:3210/integration-tokens",
          response: {
            status: 200,
            contentType: "application/json",
            body: { data: [exampleIntegrationToken] },
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/integration-tokens",
      tag: "Integrations",
      summary: "Create a managed bearer token for an explicit local integration client.",
      description:
        "The full token is returned only once. Store it in the client and use it as an Authorization bearer token. The JSON body is optional; omit it to create a token named `Local integration`.",
      request: { body: { contentType: "application/json", schema: ref("IntegrationTokenCreateRequest") } },
      responses: {
        "201": jsonResponse("Integration token created", ref("IntegrationTokenCreateResponse")),
        "400": problemResponse("Malformed JSON"),
        "415": problemResponse("Request body is not application/json"),
        "422": problemResponse("Invalid token name"),
      },
      examples: [
        {
          title: "Create an integration token",
          request:
            'curl -X POST http://127.0.0.1:3210/integration-tokens \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"Raycast MCP"}\'',
          response: {
            status: 201,
            contentType: "application/json",
            body: {
              data: {
                token: "limp_it_example_secret",
                record: exampleIntegrationToken,
              },
            },
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/integration-tokens/:id/rotate",
      tag: "Integrations",
      summary: "Rotate an active integration token and return the new bearer token once.",
      request: { pathParams: idParam() },
      responses: {
        "200": jsonResponse("Integration token rotated", ref("IntegrationTokenCreateResponse")),
        "404": problemResponse("Active integration token not found"),
      },
    },
    {
      method: "DELETE",
      path: "/integration-tokens/:id",
      tag: "Integrations",
      summary: "Revoke an integration token.",
      request: { pathParams: idParam() },
      responses: {
        "204": noContentResponse("Integration token revoked"),
        "404": problemResponse("Integration token not found"),
      },
    },
    {
      method: "ALL",
      path: "/mcp",
      tag: "MCP",
      summary: "Handle MCP Streamable HTTP transport requests.",
      description:
        "The daemon creates a fresh MCP server and transport for each request. MCP is a local integration surface and requires `Authorization: Bearer <integration-token>`.",
      responses: {
        "200": { description: "MCP transport response", contentType: "application/json or text/event-stream" },
        "401": problemResponse("Missing, invalid, rotated, or revoked integration token"),
        "500": jsonResponse("MCP request failed", ref("McpErrorResponse")),
      },
      examples: [
        {
          title: "Call the MCP endpoint",
          request:
            'curl -X POST http://127.0.0.1:3210/mcp \\\n  -H "Authorization: Bearer limp_it_example" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}\'',
          response: {
            status: 200,
            contentType: "application/json",
            body: {
              jsonrpc: "2.0",
              id: 1,
              result: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                serverInfo: {
                  name: "little-imp",
                  version: "0.1.0-beta",
                },
              },
            },
          },
        },
        {
          title: "Reject a missing integration token",
          request:
            'curl -X POST http://127.0.0.1:3210/mcp \\\n  -H "Content-Type: application/json" \\\n  -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\'',
          response: {
            status: 401,
            contentType: "application/problem+json",
            headers: { "WWW-Authenticate": 'Bearer realm="littleimp-local-integrations"' },
            body: problem(
              "https://littleimp.app/problems/integration-token-required",
              "Unauthorized",
              401,
              "A managed integration bearer token is required for this route"
            ),
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/demo/load",
      tag: "Demo",
      summary: "Load demo bookmarks into an empty library for first-run exploration.",
      description:
        "Creates a set of 10 demo bookmarks with realistic developer-content URLs, titles, categories, and tags. Only succeeds when the library has no existing bookmarks. Returns the count of created bookmarks and categories.",
      responses: {
        "200": jsonResponse("Demo data loaded", ref("DemoLoadResult")),
        "409": legacyErrorResponse("Library is not empty — demo can only be loaded on a fresh library"),
        "500": legacyErrorResponse("Failed to load demo data"),
      },
    },
  ],
} as const satisfies ApiContract;
