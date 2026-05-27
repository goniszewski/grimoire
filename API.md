# Little Imp API Documentation

> Auto-generated from `daemon/src/api/contract.ts`. Do not edit by hand.

## Contract

- Base URL: `http://127.0.0.1:3210`
- Machine-readable contract: [`docs/api-contract.json`](./docs/api-contract.json)
- Regenerate: `npm run docs:api`
- Drift check: `npm run docs:api:check`

## Authentication

The daemon is intended to bind to localhost and currently requires no authentication.

## Response Conventions

- Most JSON endpoints return `{ "data": ... }` envelopes.
- Paginated endpoints include a `pagination` object with `total`, `limit`, `offset`, and `has_more`.
- Newer route validation errors use `application/problem+json`; some backup/export routes still return `{ "error": string }`.

## Endpoints

### System

#### GET /health

Return daemon health, version, uptime, and queue size.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `HealthResponse` | Daemon health |

### Updates

#### GET /updates/check

Check a GitHub Releases-compatible source for a newer Little Imp release.

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `channel` | "stable" \| "beta" | no | Update channel to check; defaults from the current package version |
| `source` | string | no | Public GitHub Releases-compatible JSON endpoint; private and loopback hosts are rejected |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `UpdateCheckResponse` | Update check result |
| `422` | application/problem+json | `ProblemDetails` | Invalid channel or source URL |
| `502` | application/problem+json | `ProblemDetails` | Update source could not be read or returned an invalid response |

Examples:

**Check for updates**

```bash
curl 'http://127.0.0.1:3210/updates/check?channel=stable'
```

### Bookmarks

#### POST /bookmarks

Save a URL and enqueue the ingestion pipeline.

Request body:

- Content type: `application/json`
- Schema: `BookmarkCreateRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `url` | string | yes | HTTP or HTTPS URL to save |
| `title` | string | no | Optional title override |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkResponse` | Existing active bookmark returned idempotently |
| `201` | application/json | `BookmarkResponse` | Bookmark created |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `409` | application/problem+json | `ProblemDetails` | URL already exists in trash or archive |
| `422` | application/problem+json | `ProblemDetails` | Invalid URL or missing url field |

#### GET /bookmarks

List active or archived bookmarks with filters and pagination.

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `tag` | string | no | Filter by tag name |
| `domain` | string | no | Filter by exact domain |
| `category` | string | no | Filter by category name |
| `date_from` | string | no | Inclusive ISO date or date-time lower bound |
| `date_to` | string | no | Inclusive ISO date or date-time upper bound |
| `limit` | integer | no | Maximum number of results to return |
| `offset` | integer | no | Number of results to skip |
| `archived` | "true" \| "false" | no | When true, return archived bookmarks |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkListResponse` | Bookmark page |

#### GET /bookmarks/:id

Get one bookmark with extracted content.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkDetailResponse` | Bookmark detail |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |

#### PUT /bookmarks/:id

Patch bookmark fields, tags, archive state, read state, and notes.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Request body:

- Content type: `application/json`
- Schema: `BookmarkUpdateRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `title` | string \| null | no | New title, or null to clear |
| `category_id` | string \| null | no | Category ID, or null to clear |
| `tags` | array<string> | no | Replacement tag names |
| `is_pinned` | integer | no | Pinned flag, 0 or 1 |
| `is_archived` | integer | no | Archived flag, 0 or 1 |
| `read_at` | string \| null | no | ISO 8601 date-time, or null to mark unread |
| `notes` | string \| null | no | Personal notes, or null to clear |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkResponse` | Updated bookmark |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |
| `422` | application/problem+json | `ProblemDetails` | Invalid patch field |

#### DELETE /bookmarks/:id

Soft-delete a bookmark by moving it to trash.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `204` | - | - | Bookmark moved to trash |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |

#### POST /bookmarks/:id/restore

Restore a trashed bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkResponse` | Restored bookmark |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found or not in trash |
| `500` | application/problem+json | `ProblemDetails` | Restore succeeded but bookmark could not be fetched |

#### DELETE /bookmarks/:id/permanent

Permanently delete a trashed bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `204` | - | - | Bookmark permanently deleted |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found or not in trash |

#### GET /trash

List trashed bookmarks.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkArrayResponse` | Trashed bookmarks |

#### GET /bookmarks/:id/related

List semantically related bookmarks.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `limit` | integer | no | Maximum related bookmarks |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `RelatedBookmarksResponse` | Related bookmarks |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |
| `422` | application/problem+json | `ProblemDetails` | Embedding provider is not configured |

Examples:

**List related bookmarks**

```bash
curl "http://127.0.0.1:3210/bookmarks/bm_123/related?limit=5"
```

#### GET /bookmarks/:id/status

Get latest pipeline job and failure status for a bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BookmarkPipelineStatusResponse` | Bookmark pipeline status |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |

#### POST /bookmarks/:id/failure/dismiss

Dismiss the current non-blocking pipeline failure for a bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `204` | - | - | Pipeline failure dismissed |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |
| `409` | application/problem+json | `ProblemDetails` | Blocking pipeline failure cannot be dismissed |

### Reprocess

#### POST /bookmarks/:id/retry

Retry pipeline work for one bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `202` | application/json | `ReprocessBatchResponse` | Selected bookmark retry accepted |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |

#### POST /bookmarks/reprocess

Enqueue durable reprocess or re-embed jobs for existing bookmarks.

Request body:

- Content type: `application/json`
- Schema: `ReprocessRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `mode` | "selected" \| "failed_only" \| "all" \| "embeddings_only" | yes | Reprocess mode |
| `bookmark_id` | string | no | Bookmark ID required when mode is selected |
| `replace_ai_fields` | boolean | no | When true, allow reprocessing to update AI-derived title, category, and tags; manual notes are never overwritten |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `202` | application/json | `ReprocessBatchResponse` | Reprocess batch accepted |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `404` | application/problem+json | `ProblemDetails` | Selected bookmark not found |
| `422` | application/problem+json | `ProblemDetails` | Invalid reprocess request |

Examples:

**Retry failed pipeline work**

```bash
curl -X POST http://127.0.0.1:3210/bookmarks/reprocess \
  -H "Content-Type: application/json" \
  -d '{"mode":"failed_only"}'
```

#### GET /reprocess/:batchId

Return progress counts for a durable reprocess batch.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `batchId` | string | yes | batchId path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `ReprocessBatchStatusResponse` | Reprocess batch status |
| `404` | application/problem+json | `ProblemDetails` | Reprocess batch not found |

### Search

#### GET /search

Search bookmarks by keyword, semantic, or hybrid mode.

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `q` | string | no | Search query |
| `mode` | "keyword" \| "semantic" \| "hybrid" | no | Search mode |
| `tag` | string | no | Filter by tag name |
| `domain` | string | no | Filter by exact domain |
| `category` | string | no | Filter by category name |
| `date_from` | string | no | Inclusive ISO date or date-time lower bound |
| `date_to` | string | no | Inclusive ISO date or date-time upper bound |
| `limit` | integer | no | Maximum number of results to return |
| `offset` | integer | no | Number of results to skip |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `SearchResponse` | Search page |
| `400` | application/problem+json | `ProblemDetails` | Invalid FTS query syntax |
| `422` | application/problem+json | `ProblemDetails` | Invalid mode or missing embedding configuration |

### Categories

#### GET /categories

List categories as a tree with bookmark counts.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `CategoryTreeResponse` | Category tree |

#### POST /categories

Create a category.

Request body:

- Content type: `application/json`
- Schema: `CategoryRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Category name |
| `parent_id` | string \| null | no | Parent category ID |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `201` | application/json | `CategoryResponse` | Created category |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `409` | application/problem+json | `ProblemDetails` | Duplicate category under parent |
| `422` | application/problem+json | `ProblemDetails` | Invalid name or parent |

#### PUT /categories/:id

Rename or reparent a category.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Request body:

- Content type: `application/json`
- Schema: `CategoryPatchRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | no | Category name |
| `parent_id` | string \| null | no | Parent category ID |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `CategoryResponse` | Updated category |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `404` | application/problem+json | `ProblemDetails` | Category not found |
| `409` | application/problem+json | `ProblemDetails` | Duplicate category under parent |
| `422` | application/problem+json | `ProblemDetails` | Invalid patch or parent |

#### DELETE /categories/:id

Delete a category.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `204` | - | - | Category deleted |
| `404` | application/problem+json | `ProblemDetails` | Category not found |

### Tags

#### GET /tags

List tags with bookmark counts.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `TagListResponse` | Tags |

#### POST /tags

Create a tag, idempotently returning an existing tag when present.

Request body:

- Content type: `application/json`
- Schema: `TagRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Lowercase tag name |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `TagResponse` | Existing tag |
| `201` | application/json | `TagResponse` | Created tag |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `422` | application/problem+json | `ProblemDetails` | Invalid tag name |

#### DELETE /tags/:id

Delete a tag and detach it from bookmarks.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `204` | - | - | Tag deleted |
| `404` | application/problem+json | `ProblemDetails` | Tag not found |

#### POST /bookmarks/:id/tags

Attach a tag to a bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Request body:

- Content type: `application/json`
- Schema: `TagRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Lowercase tag name |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `201` | application/json | `BookmarkResponse` | Bookmark with attached tag |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `404` | application/problem+json | `ProblemDetails` | Bookmark not found |
| `422` | application/problem+json | `ProblemDetails` | Invalid tag name |

#### DELETE /bookmarks/:id/tags/:tagId

Detach a tag from a bookmark.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Bookmark ID |
| `tagId` | string | yes | Tag ID |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `204` | - | - | Tag detached |
| `404` | application/problem+json | `ProblemDetails` | Bookmark, tag, or attachment not found |

### Domains

#### GET /domains

List domains with active bookmark counts.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `DomainListResponse` | Domains |
| `500` | application/problem+json | `ProblemDetails` | Query failed |

### Import

#### POST /import

Import a Netscape HTML bookmark export.

Request body:

- Content type: `multipart/form-data`
- Multipart body with a file field containing a .html bookmark export.
- Schema: `object`

| Field | Type | Required | Description |
|---|---|---:|---|
| `file` | string | yes | HTML bookmark export file |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `ImportSummaryResponse` | Import accepted |
| `400` | application/problem+json | `ProblemDetails` | Multipart parsing failed |
| `413` | application/problem+json | `ProblemDetails` | File exceeds 10 MB |
| `415` | application/problem+json | `ProblemDetails` | Request is not multipart/form-data |
| `422` | application/problem+json | `ProblemDetails` | Missing file or invalid bookmark export |

#### GET /import/:importId/progress

Stream import progress over Server-Sent Events.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `importId` | string | yes | importId path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | text/event-stream | `ImportProgressEvent` | SSE stream of progress events |
| `404` | application/problem+json | `ProblemDetails` | Import ID not found |

### Settings

#### GET /settings

Read current settings with secrets redacted and runtime capabilities.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `SettingsResponse` | Settings |

#### PUT /settings

Deep-merge a settings patch into persisted settings.

Request body:

- Content type: `application/json`
- Schema: `SettingsPatch`

| Field | Type | Required | Description |
|---|---|---:|---|
| `ai` | object | no |  |
| `ai.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | no | LLM provider |
| `ai.openai` | object | no |  |
| `ai.openai.api_key` | string | no | OpenAI API key, empty string clears it |
| `ai.openai.model` | string | no | OpenAI chat model |
| `ai.ollama` | object | no |  |
| `ai.ollama.base_url` | string | no | Ollama base URL |
| `ai.ollama.model` | string | no | Ollama model |
| `ai.anthropic` | object | no |  |
| `ai.anthropic.api_key` | string | no | Anthropic API key, empty string clears it |
| `ai.anthropic.base_url` | string | no | Anthropic API base URL |
| `ai.anthropic.model` | string | no | Anthropic Messages API model |
| `ai.openrouter` | object | no |  |
| `ai.openrouter.api_key` | string | no | OpenRouter API key, empty string clears it |
| `ai.openrouter.base_url` | string | no | OpenRouter OpenAI-compatible base URL |
| `ai.openrouter.model` | string | no | OpenRouter model slug |
| `ai.openai_compatible` | object | no |  |
| `ai.openai_compatible.api_key` | string | no | Custom OpenAI-compatible API key, empty string clears it |
| `ai.openai_compatible.base_url` | string | no | Custom OpenAI-compatible chat base URL |
| `ai.openai_compatible.model` | string | no | Custom OpenAI-compatible chat model |
| `ai.deepseek` | object | no |  |
| `ai.deepseek.api_key` | string | no | DeepSeek API key, empty string clears it |
| `ai.deepseek.base_url` | string | no | DeepSeek OpenAI-compatible base URL |
| `ai.deepseek.model` | string | no | DeepSeek chat model |
| `ai.embeddings` | object | no |  |
| `ai.embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" | no | Embedding provider |
| `ai.embeddings.model` | string | no | Embedding model |
| `ai.embeddings.openai_compatible` | object | no |  |
| `ai.embeddings.openai_compatible.api_key` | string | no | Custom OpenAI-compatible embedding API key, empty string clears it |
| `ai.embeddings.openai_compatible.base_url` | string | no | Custom OpenAI-compatible embeddings base URL |
| `ai.embeddings.openai_compatible.model` | string | no | Custom OpenAI-compatible embedding model |
| `app` | object | no |  |
| `app.autostart` | boolean | no | Start daemon automatically |
| `app.theme` | "light" \| "dark" \| "system" | no | UI theme |
| `app.lock` | object | no |  |
| `app.lock.enabled` | boolean | no | Whether app lock is enabled |
| `app.lock.pin_hash` | string | no | PIN hash, empty string clears it |
| `backup` | object | no |  |
| `backup.local` | object | no |  |
| `backup.local.destination_path` | string | no | Absolute custom backup destination, or empty string for default |
| `backup.schedule` | object | no |  |
| `backup.schedule.enabled` | boolean | no | Enable scheduled snapshots |
| `backup.schedule.cron` | string | no | Five-part cron expression |
| `backup.schedule.retention_count` | integer | no | Number of local snapshots to retain |
| `backup.s3` | object | no |  |
| `backup.s3.endpoint` | string | no | S3-compatible endpoint URL, or empty string for AWS |
| `backup.s3.bucket` | string | no | S3 bucket |
| `backup.s3.access_key` | string | no | S3 access key |
| `backup.s3.secret_key` | string | no | S3 secret key |
| `backup.s3.region` | string | no | S3 region |
| `backup.s3.prefix` | string | no | Object key prefix |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `SettingsResponse` | Updated settings |
| `400` | application/problem+json | `ProblemDetails` | Malformed JSON |
| `422` | application/problem+json | `ProblemDetails` | Invalid settings patch |
| `500` | application/problem+json | `ProblemDetails` | Settings could not be persisted |

#### POST /settings/test-ai

Test connectivity to the configured LLM provider.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `ConnectivityTestResponse` | Connectivity result |

### Backup

#### POST /backup

Create a local backup snapshot and optionally upload it to S3.

Request body:

- Content type: `application/json`
- Schema: `BackupCreateRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `skip_remote` | boolean | no | When true, create only the local snapshot and skip S3 upload |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `201` | application/json | `BackupResult` | Backup created |
| `400` | application/json | `LegacyError` | Malformed or non-object JSON body |
| `409` | application/json | `LegacyError` | Backup or restore already in progress |
| `422` | application/json | `LegacyError` | Invalid backup create request |
| `500` | application/json | `LegacyError` | Backup creation failed |

#### GET /backup/list

List local backups and optionally merge remote S3 backups.

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `include_remote` | "true" \| "false" | no | When true, include S3 backups |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BackupListResponse` | Backups |
| `422` | application/json | `LegacyError` | S3 is not configured |
| `500` | application/json | `LegacyError` | Remote backup listing failed |

#### GET /backup/schedule

Read backup schedule settings and the computed next run time.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BackupScheduleResponse` | Backup schedule |

#### PUT /backup/schedule

Patch backup schedule settings.

Request body:

- Content type: `application/json`
- Schema: `BackupSchedulePatch`

| Field | Type | Required | Description |
|---|---|---:|---|
| `enabled` | boolean | no | Enable scheduled snapshots |
| `cron` | string | no | Five-part cron expression |
| `retention_count` | integer | no | Number of local snapshots to retain |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BackupScheduleResponse` | Updated backup schedule |
| `400` | application/json | `LegacyError` | Malformed or non-object JSON body |
| `422` | application/json | `LegacyError` | Invalid schedule patch |
| `500` | application/json | `LegacyError` | Schedule settings could not be saved |

Examples:

**Update backup schedule**

```bash
curl -X PUT http://127.0.0.1:3210/backup/schedule \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"cron":"0 3 * * *","retention_count":10}'
```

#### GET /backup/destination

Read the effective backup directory and writability.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BackupDestinationResponse` | Backup destination |

#### PUT /backup/destination

Set or clear the custom local backup directory.

Request body:

- Content type: `application/json`
- Schema: `BackupDestinationPatch`

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Absolute custom backup path, or empty string to reset |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BackupDestinationResponse` | Updated backup destination |
| `400` | application/json | `LegacyError` | Malformed or non-object JSON body |
| `422` | application/json | `LegacyError` | Invalid or unwritable path |
| `500` | application/json | `LegacyError` | Destination settings could not be saved |

Examples:

**Set a custom backup destination**

```bash
curl -X PUT http://127.0.0.1:3210/backup/destination \
  -H "Content-Type: application/json" \
  -d '{"path":"/Users/me/Backups/Little Imp"}'
```

#### POST /backup/verify

Verify a local backup snapshot without restoring it.

Request body:

- Content type: `application/json`
- Schema: `BackupVerifyRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Local backup directory name |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `BackupVerificationResult` | Backup verification result |
| `400` | application/json | `LegacyError` | Malformed JSON or non-object request body |
| `409` | application/json | `LegacyError` | Backup or restore already in progress |
| `422` | application/json | `LegacyError` | Invalid verify request or backup validation failed |
| `500` | application/json | `LegacyError` | Backup verification failed |

Examples:

**Verify a local backup**

```bash
curl -X POST http://127.0.0.1:3210/backup/verify \
  -H "Content-Type: application/json" \
  -d '{"name":"2026-05-13T09-30-00-000Z"}'
```

#### POST /backup/package

Create an encrypted package file from a local backup snapshot.

Request body:

- Content type: `application/json`
- Schema: `BackupPackageRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Local backup directory name |
| `password` | string | yes | Password used to encrypt the package |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `201` | application/json | `EncryptedBackupPackageResult` | Encrypted backup package created |
| `400` | application/json | `LegacyError` | Malformed JSON or non-object request body |
| `409` | application/json | `LegacyError` | Backup or restore already in progress |
| `422` | application/json | `LegacyError` | Invalid package request or backup validation failed |
| `500` | application/json | `LegacyError` | Encrypted backup package creation failed |

Examples:

**Create an encrypted package**

```bash
curl -X POST http://127.0.0.1:3210/backup/package \
  -H "Content-Type: application/json" \
  -d '{"name":"2026-05-13T09-30-00-000Z","password":"correct horse battery staple"}'
```

#### POST /backup/package/verify

Verify an encrypted package file without restoring it.

Request body:

- Content type: `application/json`
- Schema: `EncryptedBackupPackageRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Absolute encrypted package file path under the configured backup directory |
| `password` | string | yes | Password used to decrypt the package |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `EncryptedBackupPackageVerificationResult` | Encrypted backup package verification result |
| `400` | application/json | `LegacyError` | Malformed JSON or non-object request body |
| `409` | application/json | `LegacyError` | Backup or restore already in progress |
| `422` | application/json | `LegacyError` | Invalid package request, wrong password, or package validation failed |
| `500` | application/json | `LegacyError` | Encrypted backup package verification failed |

Examples:

**Verify an encrypted package**

```bash
curl -X POST http://127.0.0.1:3210/backup/package/verify \
  -H "Content-Type: application/json" \
  -d '{"path":"/Users/me/Library/Application Support/littleimp/backups/2026-05-13T09-30-00-000Z.littleimp-backup.enc","password":"correct horse battery staple"}'
```

#### POST /restore

Restore from a local backup directory, remote S3 snapshot, or encrypted package.

Request body:

- Content type: `application/json`
- Schema: `RestoreRequest`

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | no | Local backup directory name |
| `source` | "remote" \| "encrypted_package" | no | Restore source |
| `key` | string | no | Remote S3 snapshot.db key |
| `path` | string | no | Absolute encrypted package file path under the configured backup directory |
| `password` | string | no | Password used to decrypt the encrypted package |
| `allow_unsafe_no_checksum` | boolean | no | Allow restoring a backup with no checksum file |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `RestoreResult` | Restore completed |
| `400` | application/json | `LegacyError` | Malformed JSON |
| `409` | application/json | `LegacyError` | Backup or restore already in progress |
| `422` | application/json | `LegacyError` | Invalid restore request or backup validation failed |
| `500` | application/json | `LegacyError` | Restore failed |

Examples:

**Restore a local backup**

```bash
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"name":"2026-05-13T09-30-00-000Z"}'
```

**Restore a remote backup**

```bash
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"source":"remote","key":"little-imp/2026-05-13T09-30-00-000Z/snapshot.db"}'
```

**Restore an encrypted package**

```bash
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"source":"encrypted_package","path":"/Users/me/Library/Application Support/littleimp/backups/2026-05-13T09-30-00-000Z.littleimp-backup.enc","password":"correct horse battery staple"}'
```

#### POST /settings/test-s3

Test connectivity to the configured S3 backup destination.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `ConnectivityTestResponse` | S3 connectivity succeeded |
| `422` | application/json | `LegacyError` | S3 is not configured or connection failed |

Examples:

**Test S3 connectivity**

```bash
curl -X POST http://127.0.0.1:3210/settings/test-s3
```

### Timeline

#### GET /timeline

List timeline events with pagination.

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `limit` | integer | no | Maximum number of results to return |
| `offset` | integer | no | Number of results to skip |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `TimelinePage` | Timeline page |
| `400` | application/problem+json | `ProblemDetails` | Invalid limit or offset |

### Suggestions

#### GET /suggestions

List pending organization-agent suggestions.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `SuggestionsResponse` | Pending suggestions |

#### POST /suggestions/:id/accept

Accept a suggestion and apply its action.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `object` | Accepted suggestion |
| `404` | application/problem+json | `ProblemDetails` | Suggestion not found |
| `422` | application/problem+json | `ProblemDetails` | Suggestion is no longer pending or action is invalid |
| `500` | application/problem+json | `ProblemDetails` | Suggestion action failed |

#### POST /suggestions/:id/reject

Reject a pending suggestion.

Path parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | id path parameter |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json | `object` | Rejected suggestion |
| `404` | application/problem+json | `ProblemDetails` | Suggestion not found |
| `422` | application/problem+json | `ProblemDetails` | Suggestion is no longer pending |
| `500` | application/problem+json | `ProblemDetails` | Suggestion could not be resolved |

### Export

#### GET /export

Export active bookmarks as JSON or CSV.

Query parameters:

| Field | Type | Required | Description |
|---|---|---:|---|
| `format` | "json" \| "csv" | no | Export format |
| `tag` | string | no | Filter by tag name |
| `domain` | string | no | Filter by exact domain |
| `category` | string | no | Filter by category name |
| `date_from` | string | no | Inclusive ISO date or date-time lower bound |
| `date_to` | string | no | Inclusive ISO date or date-time upper bound |

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json or text/csv | `array<ExportBookmark>` | Downloadable JSON or CSV export |
| `400` | application/json | `LegacyError` | Invalid format |

### MCP

#### ALL /mcp

Handle MCP Streamable HTTP transport requests.

The daemon creates a fresh MCP server and transport for each request.

Responses:

| Status | Content type | Schema | Description |
|---|---|---|---|
| `200` | application/json or text/event-stream | - | MCP transport response |
| `500` | application/json | `McpErrorResponse` | MCP request failed |

Examples:

**Call the MCP endpoint**

```bash
curl -X POST http://127.0.0.1:3210/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

## Schemas

### ProblemDetails

RFC 7807-style problem response

| Field | Type | Required | Description |
|---|---|---:|---|
| `type` | string | yes | Stable problem type URI |
| `title` | string | yes | Short human-readable error title |
| `status` | integer | yes | HTTP status code |
| `detail` | string \| null | no | Human-readable explanation |

### LegacyError

Legacy JSON error response

| Field | Type | Required | Description |
|---|---|---:|---|
| `error` | string | yes | Human-readable error message |
| `details` | string \| null | no | Optional additional details |

### Pagination

| Field | Type | Required | Description |
|---|---|---:|---|
| `total` | integer | yes | Total matching records |
| `limit` | integer | yes | Applied page size |
| `offset` | integer | yes | Applied offset |
| `has_more` | boolean | yes | Whether another page exists |

### Bookmark

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Bookmark ID |
| `url` | string | yes | Original bookmark URL |
| `domain` | string | yes | URL hostname |
| `title` | string \| null | yes | Page title |
| `description` | string \| null | yes | Page description |
| `status` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Pipeline status |
| `category_id` | string \| null | yes | Assigned category ID |
| `favicon_url` | string \| null | yes | Favicon URL |
| `screenshot_url` | string \| null | yes | Screenshot URL |
| `is_pinned` | 0 \| 1 | yes | Pinned flag, 0 or 1 |
| `is_archived` | 0 \| 1 | yes | Archived flag, 0 or 1 |
| `is_trashed` | 0 \| 1 | yes | Trash flag, 0 or 1 |
| `trashed_at` | string \| null | yes | Trash timestamp |
| `read_at` | string \| null | yes | Read timestamp |
| `notes` | string \| null | yes | Personal notes |
| `created_at` | string | yes | Creation timestamp |
| `updated_at` | string | yes | Update timestamp |
| `tags` | array<string> | yes | Tag names attached to the bookmark |

### BookmarkContent

| Field | Type | Required | Description |
|---|---|---:|---|
| `bookmark_id` | string | yes | Bookmark ID |
| `raw_html` | string \| null | yes | Raw HTML |
| `markdown` | string \| null | yes | Extracted Markdown |
| `summary` | string \| null | yes | Extracted summary |
| `author` | string \| null | yes | Author |
| `published_at` | string \| null | yes | Published timestamp |
| `word_count` | integer \| null | yes | Estimated word count |
| `language` | string \| null | yes | Detected language |
| `extracted_at` | string | yes | Extraction timestamp |

### BookmarkDetail

Bookmark with extracted content

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Bookmark ID |
| `url` | string | yes | Original bookmark URL |
| `domain` | string | yes | URL hostname |
| `title` | string \| null | yes | Page title |
| `description` | string \| null | yes | Page description |
| `status` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Pipeline status |
| `category_id` | string \| null | yes | Assigned category ID |
| `favicon_url` | string \| null | yes | Favicon URL |
| `screenshot_url` | string \| null | yes | Screenshot URL |
| `is_pinned` | 0 \| 1 | yes | Pinned flag, 0 or 1 |
| `is_archived` | 0 \| 1 | yes | Archived flag, 0 or 1 |
| `is_trashed` | 0 \| 1 | yes | Trash flag, 0 or 1 |
| `trashed_at` | string \| null | yes | Trash timestamp |
| `read_at` | string \| null | yes | Read timestamp |
| `notes` | string \| null | yes | Personal notes |
| `created_at` | string | yes | Creation timestamp |
| `updated_at` | string | yes | Update timestamp |
| `tags` | array<string> | yes | Tag names attached to the bookmark |
| `content` | BookmarkContent \| null | yes |  |
| `content.bookmark_id` | string | yes | Bookmark ID |
| `content.raw_html` | string \| null | yes | Raw HTML |
| `content.markdown` | string \| null | yes | Extracted Markdown |
| `content.summary` | string \| null | yes | Extracted summary |
| `content.author` | string \| null | yes | Author |
| `content.published_at` | string \| null | yes | Published timestamp |
| `content.word_count` | integer \| null | yes | Estimated word count |
| `content.language` | string \| null | yes | Detected language |
| `content.extracted_at` | string | yes | Extraction timestamp |

### BookmarkDetailResponse

Single bookmark response

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | BookmarkDetail | yes |  |
| `data.id` | string | yes | Bookmark ID |
| `data.url` | string | yes | Original bookmark URL |
| `data.domain` | string | yes | URL hostname |
| `data.title` | string \| null | yes | Page title |
| `data.description` | string \| null | yes | Page description |
| `data.status` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Pipeline status |
| `data.category_id` | string \| null | yes | Assigned category ID |
| `data.favicon_url` | string \| null | yes | Favicon URL |
| `data.screenshot_url` | string \| null | yes | Screenshot URL |
| `data.is_pinned` | 0 \| 1 | yes | Pinned flag, 0 or 1 |
| `data.is_archived` | 0 \| 1 | yes | Archived flag, 0 or 1 |
| `data.is_trashed` | 0 \| 1 | yes | Trash flag, 0 or 1 |
| `data.trashed_at` | string \| null | yes | Trash timestamp |
| `data.read_at` | string \| null | yes | Read timestamp |
| `data.notes` | string \| null | yes | Personal notes |
| `data.created_at` | string | yes | Creation timestamp |
| `data.updated_at` | string | yes | Update timestamp |
| `data.tags` | array<string> | yes | Tag names attached to the bookmark |
| `data.content` | BookmarkContent \| null | yes |  |
| `data.content.bookmark_id` | string | yes | Bookmark ID |
| `data.content.raw_html` | string \| null | yes | Raw HTML |
| `data.content.markdown` | string \| null | yes | Extracted Markdown |
| `data.content.summary` | string \| null | yes | Extracted summary |
| `data.content.author` | string \| null | yes | Author |
| `data.content.published_at` | string \| null | yes | Published timestamp |
| `data.content.word_count` | integer \| null | yes | Estimated word count |
| `data.content.language` | string \| null | yes | Detected language |
| `data.content.extracted_at` | string | yes | Extraction timestamp |

### BookmarkResponse

Single bookmark response

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | Bookmark | yes |  |
| `data.id` | string | yes | Bookmark ID |
| `data.url` | string | yes | Original bookmark URL |
| `data.domain` | string | yes | URL hostname |
| `data.title` | string \| null | yes | Page title |
| `data.description` | string \| null | yes | Page description |
| `data.status` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Pipeline status |
| `data.category_id` | string \| null | yes | Assigned category ID |
| `data.favicon_url` | string \| null | yes | Favicon URL |
| `data.screenshot_url` | string \| null | yes | Screenshot URL |
| `data.is_pinned` | 0 \| 1 | yes | Pinned flag, 0 or 1 |
| `data.is_archived` | 0 \| 1 | yes | Archived flag, 0 or 1 |
| `data.is_trashed` | 0 \| 1 | yes | Trash flag, 0 or 1 |
| `data.trashed_at` | string \| null | yes | Trash timestamp |
| `data.read_at` | string \| null | yes | Read timestamp |
| `data.notes` | string \| null | yes | Personal notes |
| `data.created_at` | string | yes | Creation timestamp |
| `data.updated_at` | string | yes | Update timestamp |
| `data.tags` | array<string> | yes | Tag names attached to the bookmark |

### BookmarkListResponse

Paginated bookmark list

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<Bookmark> | yes | Page items |
| `pagination` | Pagination | yes |  |
| `pagination.total` | integer | yes | Total matching records |
| `pagination.limit` | integer | yes | Applied page size |
| `pagination.offset` | integer | yes | Applied offset |
| `pagination.has_more` | boolean | yes | Whether another page exists |

### BookmarkArrayResponse

Bookmark array response

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<Bookmark> | yes | Bookmarks |

### BookmarkCreateRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `url` | string | yes | HTTP or HTTPS URL to save |
| `title` | string | no | Optional title override |

### BookmarkUpdateRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `title` | string \| null | no | New title, or null to clear |
| `category_id` | string \| null | no | Category ID, or null to clear |
| `tags` | array<string> | no | Replacement tag names |
| `is_pinned` | integer | no | Pinned flag, 0 or 1 |
| `is_archived` | integer | no | Archived flag, 0 or 1 |
| `read_at` | string \| null | no | ISO 8601 date-time, or null to mark unread |
| `notes` | string \| null | no | Personal notes, or null to clear |

### RelatedBookmarksResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<Bookmark> | yes | Related bookmarks |

### PipelineFailure

Latest actionable pipeline failure for a bookmark

| Field | Type | Required | Description |
|---|---|---:|---|
| `stage` | "fetch" \| "extract" \| "ai_enrich" \| "embed" \| "index" | yes | Pipeline stage that last reported an actionable failure |
| `message` | string | yes | Failure message safe to show in the local UI |
| `configuration_related` | boolean | yes | Whether the failure likely requires provider settings |
| `retryable` | boolean | yes | Whether retrying the bookmark pipeline is supported |
| `failed_at` | string | yes | Failure timestamp |
| `dismissed_at` | string \| null | yes | Dismissal timestamp |

### BookmarkPipelineStatus

| Field | Type | Required | Description |
|---|---|---:|---|
| `bookmarkId` | string | yes | Bookmark ID |
| `bookmarkStatus` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Current bookmark pipeline status |
| `last_failure` | PipelineFailure \| null | yes |  |
| `last_failure.stage` | "fetch" \| "extract" \| "ai_enrich" \| "embed" \| "index" | yes | Pipeline stage that last reported an actionable failure |
| `last_failure.message` | string | yes | Failure message safe to show in the local UI |
| `last_failure.configuration_related` | boolean | yes | Whether the failure likely requires provider settings |
| `last_failure.retryable` | boolean | yes | Whether retrying the bookmark pipeline is supported |
| `last_failure.failed_at` | string | yes | Failure timestamp |
| `last_failure.dismissed_at` | string \| null | yes | Dismissal timestamp |
| `job` | object \| null | yes |  |
| `job.id` | string | yes | Job ID |
| `job.type` | string | yes | Job type |
| `job.status` | "pending" \| "running" \| "done" \| "failed" | yes | Job status |
| `job.error` | string \| null | yes | Job error |
| `job.created_at` | string | yes | Job creation timestamp |
| `job.started_at` | string \| null | yes | Job start timestamp |
| `job.finished_at` | string \| null | yes | Job finish timestamp |

### BookmarkPipelineStatusResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | BookmarkPipelineStatus | yes |  |
| `data.bookmarkId` | string | yes | Bookmark ID |
| `data.bookmarkStatus` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Current bookmark pipeline status |
| `data.last_failure` | PipelineFailure \| null | yes |  |
| `data.last_failure.stage` | "fetch" \| "extract" \| "ai_enrich" \| "embed" \| "index" | yes | Pipeline stage that last reported an actionable failure |
| `data.last_failure.message` | string | yes | Failure message safe to show in the local UI |
| `data.last_failure.configuration_related` | boolean | yes | Whether the failure likely requires provider settings |
| `data.last_failure.retryable` | boolean | yes | Whether retrying the bookmark pipeline is supported |
| `data.last_failure.failed_at` | string | yes | Failure timestamp |
| `data.last_failure.dismissed_at` | string \| null | yes | Dismissal timestamp |
| `data.job` | object \| null | yes |  |
| `data.job.id` | string | yes | Job ID |
| `data.job.type` | string | yes | Job type |
| `data.job.status` | "pending" \| "running" \| "done" \| "failed" | yes | Job status |
| `data.job.error` | string \| null | yes | Job error |
| `data.job.created_at` | string | yes | Job creation timestamp |
| `data.job.started_at` | string \| null | yes | Job start timestamp |
| `data.job.finished_at` | string \| null | yes | Job finish timestamp |

### ReprocessRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `mode` | "selected" \| "failed_only" \| "all" \| "embeddings_only" | yes | Reprocess mode |
| `bookmark_id` | string | no | Bookmark ID required when mode is selected |
| `replace_ai_fields` | boolean | no | When true, allow reprocessing to update AI-derived title, category, and tags; manual notes are never overwritten |

### ReprocessBatch

| Field | Type | Required | Description |
|---|---|---:|---|
| `batch_id` | string | yes | Reprocess batch ID |
| `mode` | "selected" \| "failed_only" \| "all" \| "embeddings_only" | yes | Accepted reprocess mode |
| `requested` | integer | yes | Target bookmarks considered |
| `enqueued` | integer | yes | Jobs enqueued |
| `skipped` | integer | yes | Bookmarks skipped because work is already queued or running |
| `job_ids` | array<string> | yes | Queued job IDs |
| `status_url` | string \| null | yes | Batch status URL when jobs were enqueued |

### ReprocessBatchResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | ReprocessBatch | yes |  |
| `data.batch_id` | string | yes | Reprocess batch ID |
| `data.mode` | "selected" \| "failed_only" \| "all" \| "embeddings_only" | yes | Accepted reprocess mode |
| `data.requested` | integer | yes | Target bookmarks considered |
| `data.enqueued` | integer | yes | Jobs enqueued |
| `data.skipped` | integer | yes | Bookmarks skipped because work is already queued or running |
| `data.job_ids` | array<string> | yes | Queued job IDs |
| `data.status_url` | string \| null | yes | Batch status URL when jobs were enqueued |

### ReprocessBatchStatus

| Field | Type | Required | Description |
|---|---|---:|---|
| `batch_id` | string | yes | Reprocess batch ID |
| `total` | integer | yes | Total jobs in the batch |
| `pending` | integer | yes | Pending jobs |
| `running` | integer | yes | Running jobs |
| `done` | integer | yes | Completed jobs |
| `failed` | integer | yes | Failed jobs |

### ReprocessBatchStatusResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | ReprocessBatchStatus | yes |  |
| `data.batch_id` | string | yes | Reprocess batch ID |
| `data.total` | integer | yes | Total jobs in the batch |
| `data.pending` | integer | yes | Pending jobs |
| `data.running` | integer | yes | Running jobs |
| `data.done` | integer | yes | Completed jobs |
| `data.failed` | integer | yes | Failed jobs |

### SearchResultItem

Bookmark search hit

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Bookmark ID |
| `url` | string | yes | Original bookmark URL |
| `domain` | string | yes | URL hostname |
| `title` | string \| null | yes | Page title |
| `description` | string \| null | yes | Page description |
| `status` | "saved" \| "fetched" \| "extracted" \| "ai_enriched" \| "indexed" | yes | Pipeline status |
| `category_id` | string \| null | yes | Assigned category ID |
| `favicon_url` | string \| null | yes | Favicon URL |
| `screenshot_url` | string \| null | yes | Screenshot URL |
| `is_pinned` | 0 \| 1 | yes | Pinned flag, 0 or 1 |
| `is_archived` | 0 \| 1 | yes | Archived flag, 0 or 1 |
| `is_trashed` | 0 \| 1 | yes | Trash flag, 0 or 1 |
| `trashed_at` | string \| null | yes | Trash timestamp |
| `read_at` | string \| null | yes | Read timestamp |
| `notes` | string \| null | yes | Personal notes |
| `created_at` | string | yes | Creation timestamp |
| `updated_at` | string | yes | Update timestamp |
| `tags` | array<string> | yes | Tag names attached to the bookmark |
| `snippet` | string \| null | yes | Highlighted search excerpt |
| `rank` | number \| null | yes | Search rank or hybrid score |

### SearchResponse

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<SearchResultItem> | yes | Search hits |
| `pagination` | Pagination | yes |  |
| `pagination.total` | integer | yes | Total matching records |
| `pagination.limit` | integer | yes | Applied page size |
| `pagination.offset` | integer | yes | Applied offset |
| `pagination.has_more` | boolean | yes | Whether another page exists |
| `meta` | object | yes |  |
| `meta.mode` | "keyword" \| "semantic" \| "hybrid" | yes | Applied search mode |

### CategoryRecord

Category row returned by create and update endpoints

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Category ID |
| `name` | string | yes | Category name |
| `parent_id` | string \| null | yes | Parent category ID |
| `created_at` | string | yes | Creation timestamp |
| `updated_at` | string | yes | Update timestamp |

### CategoryWithCount

Category row with active bookmark count returned by category listings

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Category ID |
| `name` | string | yes | Category name |
| `parent_id` | string \| null | yes | Parent category ID |
| `created_at` | string | yes | Creation timestamp |
| `updated_at` | string | yes | Update timestamp |
| `bookmark_count` | integer | yes | Active bookmark count |

### CategoryNode

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Category ID |
| `name` | string | yes | Category name |
| `parent_id` | string \| null | yes | Parent category ID |
| `created_at` | string | yes | Creation timestamp |
| `updated_at` | string | yes | Update timestamp |
| `bookmark_count` | integer | yes | Active bookmark count |
| `children` | array<CategoryNode> | yes | Child categories |

### CategoryRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Category name |
| `parent_id` | string \| null | no | Parent category ID |

### CategoryPatchRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | no | Category name |
| `parent_id` | string \| null | no | Parent category ID |

### CategoryTreeResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<CategoryNode> | yes | Category tree |

### CategoryResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | CategoryRecord | yes |  |
| `data.id` | string | yes | Category ID |
| `data.name` | string | yes | Category name |
| `data.parent_id` | string \| null | yes | Parent category ID |
| `data.created_at` | string | yes | Creation timestamp |
| `data.updated_at` | string | yes | Update timestamp |

### TagRecord

Tag row returned by create and attach endpoints

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Tag ID |
| `name` | string | yes | Tag name |
| `created_at` | string | yes | Creation timestamp |

### TagWithCount

Tag row with active bookmark count returned by tag listings

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Tag ID |
| `name` | string | yes | Tag name |
| `created_at` | string | yes | Creation timestamp |
| `bookmark_count` | integer | yes | Active bookmark count |

### TagRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Lowercase tag name |

### TagListResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<TagWithCount> | yes | Tags |

### TagResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | TagRecord | yes |  |
| `data.id` | string | yes | Tag ID |
| `data.name` | string | yes | Tag name |
| `data.created_at` | string | yes | Creation timestamp |

### Domain

| Field | Type | Required | Description |
|---|---|---:|---|
| `domain` | string | yes | Domain |
| `count` | integer | yes | Active bookmark count |

### DomainListResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<Domain> | yes | Domains |

### ImportSummary

| Field | Type | Required | Description |
|---|---|---:|---|
| `importId` | string | yes | Import ID for progress stream |
| `total` | integer | yes | Parsed bookmark count |
| `warnings` | integer | yes | Parser warning count |
| `progressUrl` | string | yes | SSE progress URL |

### ImportSummaryResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | ImportSummary | yes |  |
| `data.importId` | string | yes | Import ID for progress stream |
| `data.total` | integer | yes | Parsed bookmark count |
| `data.warnings` | integer | yes | Parser warning count |
| `data.progressUrl` | string | yes | SSE progress URL |

### ImportProgressEvent

| Field | Type | Required | Description |
|---|---|---:|---|
| `queued` | integer | yes | Queued bookmarks |
| `skipped` | integer | yes | Skipped bookmarks |
| `total` | integer | yes | Total parsed bookmarks |
| `done` | boolean | yes | Whether import processing is complete |
| `error` | string \| null | yes | Background import error |

### RuntimeLlmCapability

| Field | Type | Required | Description |
|---|---|---:|---|
| `enabled` | boolean | yes | Whether this runtime feature is usable |
| `provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | yes | Resolved provider |
| `model` | string \| null | yes | Resolved model |
| `base_url` | string \| null | yes | Resolved base URL |

### RuntimeEmbeddingCapability

| Field | Type | Required | Description |
|---|---|---:|---|
| `enabled` | boolean | yes | Whether this runtime feature is usable |
| `provider` | "openai" \| "ollama" \| "openai_compatible" \| "none" | yes | Resolved embedding provider |
| `model` | string \| null | yes | Resolved model |
| `base_url` | string \| null | yes | Resolved base URL |

### RuntimeCapabilities

| Field | Type | Required | Description |
|---|---|---:|---|
| `llm` | RuntimeLlmCapability | yes |  |
| `llm.enabled` | boolean | yes | Whether this runtime feature is usable |
| `llm.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | yes | Resolved provider |
| `llm.model` | string \| null | yes | Resolved model |
| `llm.base_url` | string \| null | yes | Resolved base URL |
| `embeddings` | RuntimeEmbeddingCapability | yes |  |
| `embeddings.enabled` | boolean | yes | Whether this runtime feature is usable |
| `embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" \| "none" | yes | Resolved embedding provider |
| `embeddings.model` | string \| null | yes | Resolved model |
| `embeddings.base_url` | string \| null | yes | Resolved base URL |
| `capabilities` | object | yes |  |
| `capabilities.enrichment` | boolean | yes | LLM enrichment available |
| `capabilities.semantic_search` | boolean | yes | Semantic search available |
| `capabilities.related_bookmarks` | boolean | yes | Related bookmarks available |
| `capabilities.organization_agent` | boolean | yes | Organization agent available |

### SettingsBackupSchedule

| Field | Type | Required | Description |
|---|---|---:|---|
| `enabled` | boolean | yes | Enable scheduled snapshots |
| `cron` | string | yes | Five-part cron expression |
| `retention_count` | integer | yes | Number of local snapshots to retain |

### Settings

| Field | Type | Required | Description |
|---|---|---:|---|
| `ai` | object | yes |  |
| `ai.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | yes | LLM provider |
| `ai.openai` | object | yes |  |
| `ai.openai.api_key` | string | yes | Redacted OpenAI API key. Empty string means unset |
| `ai.openai.model` | string | yes | OpenAI chat model |
| `ai.ollama` | object | yes |  |
| `ai.ollama.base_url` | string | yes | Ollama base URL |
| `ai.ollama.model` | string | yes | Ollama model |
| `ai.anthropic` | object | yes |  |
| `ai.anthropic.api_key` | string | yes | Redacted Anthropic API key. Empty string means unset |
| `ai.anthropic.base_url` | string | yes | Anthropic API base URL |
| `ai.anthropic.model` | string | yes | Anthropic Messages API model |
| `ai.openrouter` | object | yes |  |
| `ai.openrouter.api_key` | string | yes | Redacted OpenRouter API key. Empty string means unset |
| `ai.openrouter.base_url` | string | yes | OpenRouter OpenAI-compatible base URL |
| `ai.openrouter.model` | string | yes | OpenRouter model slug |
| `ai.openai_compatible` | object | yes |  |
| `ai.openai_compatible.api_key` | string | yes | Redacted custom OpenAI-compatible API key. Empty string means unset |
| `ai.openai_compatible.base_url` | string | yes | Custom OpenAI-compatible chat base URL |
| `ai.openai_compatible.model` | string | yes | Custom OpenAI-compatible chat model |
| `ai.deepseek` | object | yes |  |
| `ai.deepseek.api_key` | string | yes | Redacted DeepSeek API key. Empty string means unset |
| `ai.deepseek.base_url` | string | yes | DeepSeek OpenAI-compatible base URL |
| `ai.deepseek.model` | string | yes | DeepSeek chat model |
| `ai.embeddings` | object | yes |  |
| `ai.embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" | yes | Embedding provider |
| `ai.embeddings.model` | string | yes | Embedding model |
| `ai.embeddings.openai_compatible` | object | yes |  |
| `ai.embeddings.openai_compatible.api_key` | string | yes | Redacted custom OpenAI-compatible embedding API key. Empty string means unset |
| `ai.embeddings.openai_compatible.base_url` | string | yes | Custom OpenAI-compatible embeddings base URL |
| `ai.embeddings.openai_compatible.model` | string | yes | Custom OpenAI-compatible embedding model |
| `app` | object | yes |  |
| `app.autostart` | boolean | yes | Start daemon automatically |
| `app.theme` | "light" \| "dark" \| "system" | yes | UI theme |
| `app.lock` | object | yes |  |
| `app.lock.enabled` | boolean | yes | Whether app lock is enabled |
| `app.lock.pin_hash` | string | yes | Redacted PIN hash. Empty string means unset |
| `backup` | object | yes |  |
| `backup.local` | object | yes |  |
| `backup.local.destination_path` | string | yes | Absolute custom backup destination, or empty string for default |
| `backup.schedule` | SettingsBackupSchedule | yes |  |
| `backup.schedule.enabled` | boolean | yes | Enable scheduled snapshots |
| `backup.schedule.cron` | string | yes | Five-part cron expression |
| `backup.schedule.retention_count` | integer | yes | Number of local snapshots to retain |
| `backup.s3` | object | yes |  |
| `backup.s3.endpoint` | string | yes | S3-compatible endpoint URL, or empty string for AWS |
| `backup.s3.bucket` | string | yes | S3 bucket |
| `backup.s3.access_key` | string | yes | Redacted S3 access key. Empty string means unset |
| `backup.s3.secret_key` | string | yes | Redacted S3 secret key. Empty string means unset |
| `backup.s3.region` | string | yes | S3 region |
| `backup.s3.prefix` | string | yes | Object key prefix |
| `runtime` | RuntimeCapabilities | yes |  |
| `runtime.llm` | RuntimeLlmCapability | yes |  |
| `runtime.llm.enabled` | boolean | yes | Whether this runtime feature is usable |
| `runtime.llm.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | yes | Resolved provider |
| `runtime.llm.model` | string \| null | yes | Resolved model |
| `runtime.llm.base_url` | string \| null | yes | Resolved base URL |
| `runtime.embeddings` | RuntimeEmbeddingCapability | yes |  |
| `runtime.embeddings.enabled` | boolean | yes | Whether this runtime feature is usable |
| `runtime.embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" \| "none" | yes | Resolved embedding provider |
| `runtime.embeddings.model` | string \| null | yes | Resolved model |
| `runtime.embeddings.base_url` | string \| null | yes | Resolved base URL |
| `runtime.capabilities` | object | yes |  |
| `runtime.capabilities.enrichment` | boolean | yes | LLM enrichment available |
| `runtime.capabilities.semantic_search` | boolean | yes | Semantic search available |
| `runtime.capabilities.related_bookmarks` | boolean | yes | Related bookmarks available |
| `runtime.capabilities.organization_agent` | boolean | yes | Organization agent available |

### SettingsPatch

| Field | Type | Required | Description |
|---|---|---:|---|
| `ai` | object | no |  |
| `ai.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | no | LLM provider |
| `ai.openai` | object | no |  |
| `ai.openai.api_key` | string | no | OpenAI API key, empty string clears it |
| `ai.openai.model` | string | no | OpenAI chat model |
| `ai.ollama` | object | no |  |
| `ai.ollama.base_url` | string | no | Ollama base URL |
| `ai.ollama.model` | string | no | Ollama model |
| `ai.anthropic` | object | no |  |
| `ai.anthropic.api_key` | string | no | Anthropic API key, empty string clears it |
| `ai.anthropic.base_url` | string | no | Anthropic API base URL |
| `ai.anthropic.model` | string | no | Anthropic Messages API model |
| `ai.openrouter` | object | no |  |
| `ai.openrouter.api_key` | string | no | OpenRouter API key, empty string clears it |
| `ai.openrouter.base_url` | string | no | OpenRouter OpenAI-compatible base URL |
| `ai.openrouter.model` | string | no | OpenRouter model slug |
| `ai.openai_compatible` | object | no |  |
| `ai.openai_compatible.api_key` | string | no | Custom OpenAI-compatible API key, empty string clears it |
| `ai.openai_compatible.base_url` | string | no | Custom OpenAI-compatible chat base URL |
| `ai.openai_compatible.model` | string | no | Custom OpenAI-compatible chat model |
| `ai.deepseek` | object | no |  |
| `ai.deepseek.api_key` | string | no | DeepSeek API key, empty string clears it |
| `ai.deepseek.base_url` | string | no | DeepSeek OpenAI-compatible base URL |
| `ai.deepseek.model` | string | no | DeepSeek chat model |
| `ai.embeddings` | object | no |  |
| `ai.embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" | no | Embedding provider |
| `ai.embeddings.model` | string | no | Embedding model |
| `ai.embeddings.openai_compatible` | object | no |  |
| `ai.embeddings.openai_compatible.api_key` | string | no | Custom OpenAI-compatible embedding API key, empty string clears it |
| `ai.embeddings.openai_compatible.base_url` | string | no | Custom OpenAI-compatible embeddings base URL |
| `ai.embeddings.openai_compatible.model` | string | no | Custom OpenAI-compatible embedding model |
| `app` | object | no |  |
| `app.autostart` | boolean | no | Start daemon automatically |
| `app.theme` | "light" \| "dark" \| "system" | no | UI theme |
| `app.lock` | object | no |  |
| `app.lock.enabled` | boolean | no | Whether app lock is enabled |
| `app.lock.pin_hash` | string | no | PIN hash, empty string clears it |
| `backup` | object | no |  |
| `backup.local` | object | no |  |
| `backup.local.destination_path` | string | no | Absolute custom backup destination, or empty string for default |
| `backup.schedule` | object | no |  |
| `backup.schedule.enabled` | boolean | no | Enable scheduled snapshots |
| `backup.schedule.cron` | string | no | Five-part cron expression |
| `backup.schedule.retention_count` | integer | no | Number of local snapshots to retain |
| `backup.s3` | object | no |  |
| `backup.s3.endpoint` | string | no | S3-compatible endpoint URL, or empty string for AWS |
| `backup.s3.bucket` | string | no | S3 bucket |
| `backup.s3.access_key` | string | no | S3 access key |
| `backup.s3.secret_key` | string | no | S3 secret key |
| `backup.s3.region` | string | no | S3 region |
| `backup.s3.prefix` | string | no | Object key prefix |

### SettingsResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | Settings | yes |  |
| `data.ai` | object | yes |  |
| `data.ai.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | yes | LLM provider |
| `data.ai.openai` | object | yes |  |
| `data.ai.openai.api_key` | string | yes | Redacted OpenAI API key. Empty string means unset |
| `data.ai.openai.model` | string | yes | OpenAI chat model |
| `data.ai.ollama` | object | yes |  |
| `data.ai.ollama.base_url` | string | yes | Ollama base URL |
| `data.ai.ollama.model` | string | yes | Ollama model |
| `data.ai.anthropic` | object | yes |  |
| `data.ai.anthropic.api_key` | string | yes | Redacted Anthropic API key. Empty string means unset |
| `data.ai.anthropic.base_url` | string | yes | Anthropic API base URL |
| `data.ai.anthropic.model` | string | yes | Anthropic Messages API model |
| `data.ai.openrouter` | object | yes |  |
| `data.ai.openrouter.api_key` | string | yes | Redacted OpenRouter API key. Empty string means unset |
| `data.ai.openrouter.base_url` | string | yes | OpenRouter OpenAI-compatible base URL |
| `data.ai.openrouter.model` | string | yes | OpenRouter model slug |
| `data.ai.openai_compatible` | object | yes |  |
| `data.ai.openai_compatible.api_key` | string | yes | Redacted custom OpenAI-compatible API key. Empty string means unset |
| `data.ai.openai_compatible.base_url` | string | yes | Custom OpenAI-compatible chat base URL |
| `data.ai.openai_compatible.model` | string | yes | Custom OpenAI-compatible chat model |
| `data.ai.deepseek` | object | yes |  |
| `data.ai.deepseek.api_key` | string | yes | Redacted DeepSeek API key. Empty string means unset |
| `data.ai.deepseek.base_url` | string | yes | DeepSeek OpenAI-compatible base URL |
| `data.ai.deepseek.model` | string | yes | DeepSeek chat model |
| `data.ai.embeddings` | object | yes |  |
| `data.ai.embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" | yes | Embedding provider |
| `data.ai.embeddings.model` | string | yes | Embedding model |
| `data.ai.embeddings.openai_compatible` | object | yes |  |
| `data.ai.embeddings.openai_compatible.api_key` | string | yes | Redacted custom OpenAI-compatible embedding API key. Empty string means unset |
| `data.ai.embeddings.openai_compatible.base_url` | string | yes | Custom OpenAI-compatible embeddings base URL |
| `data.ai.embeddings.openai_compatible.model` | string | yes | Custom OpenAI-compatible embedding model |
| `data.app` | object | yes |  |
| `data.app.autostart` | boolean | yes | Start daemon automatically |
| `data.app.theme` | "light" \| "dark" \| "system" | yes | UI theme |
| `data.app.lock` | object | yes |  |
| `data.app.lock.enabled` | boolean | yes | Whether app lock is enabled |
| `data.app.lock.pin_hash` | string | yes | Redacted PIN hash. Empty string means unset |
| `data.backup` | object | yes |  |
| `data.backup.local` | object | yes |  |
| `data.backup.local.destination_path` | string | yes | Absolute custom backup destination, or empty string for default |
| `data.backup.schedule` | SettingsBackupSchedule | yes |  |
| `data.backup.schedule.enabled` | boolean | yes | Enable scheduled snapshots |
| `data.backup.schedule.cron` | string | yes | Five-part cron expression |
| `data.backup.schedule.retention_count` | integer | yes | Number of local snapshots to retain |
| `data.backup.s3` | object | yes |  |
| `data.backup.s3.endpoint` | string | yes | S3-compatible endpoint URL, or empty string for AWS |
| `data.backup.s3.bucket` | string | yes | S3 bucket |
| `data.backup.s3.access_key` | string | yes | Redacted S3 access key. Empty string means unset |
| `data.backup.s3.secret_key` | string | yes | Redacted S3 secret key. Empty string means unset |
| `data.backup.s3.region` | string | yes | S3 region |
| `data.backup.s3.prefix` | string | yes | Object key prefix |
| `data.runtime` | RuntimeCapabilities | yes |  |
| `data.runtime.llm` | RuntimeLlmCapability | yes |  |
| `data.runtime.llm.enabled` | boolean | yes | Whether this runtime feature is usable |
| `data.runtime.llm.provider` | "openai" \| "ollama" \| "anthropic" \| "openrouter" \| "openai_compatible" \| "deepseek" \| "none" | yes | Resolved provider |
| `data.runtime.llm.model` | string \| null | yes | Resolved model |
| `data.runtime.llm.base_url` | string \| null | yes | Resolved base URL |
| `data.runtime.embeddings` | RuntimeEmbeddingCapability | yes |  |
| `data.runtime.embeddings.enabled` | boolean | yes | Whether this runtime feature is usable |
| `data.runtime.embeddings.provider` | "openai" \| "ollama" \| "openai_compatible" \| "none" | yes | Resolved embedding provider |
| `data.runtime.embeddings.model` | string \| null | yes | Resolved model |
| `data.runtime.embeddings.base_url` | string \| null | yes | Resolved base URL |
| `data.runtime.capabilities` | object | yes |  |
| `data.runtime.capabilities.enrichment` | boolean | yes | LLM enrichment available |
| `data.runtime.capabilities.semantic_search` | boolean | yes | Semantic search available |
| `data.runtime.capabilities.related_bookmarks` | boolean | yes | Related bookmarks available |
| `data.runtime.capabilities.organization_agent` | boolean | yes | Organization agent available |

### ConnectivityTestResponse

| Field | Type | Required | Description |
|---|---|---:|---|
| `ok` | boolean | yes | Whether the connectivity check succeeded |
| `error` | string | no | Failure reason |
| `message` | string | no | Success message |

### BackupSchedule

| Field | Type | Required | Description |
|---|---|---:|---|
| `enabled` | boolean | yes | Enable scheduled snapshots |
| `cron` | string | yes | Five-part cron expression |
| `retention_count` | integer | yes | Number of local snapshots to retain |
| `next_run_at` | string \| null | yes | Next scheduled run timestamp |

### BackupSchedulePatch

| Field | Type | Required | Description |
|---|---|---:|---|
| `enabled` | boolean | no | Enable scheduled snapshots |
| `cron` | string | no | Five-part cron expression |
| `retention_count` | integer | no | Number of local snapshots to retain |

### BackupScheduleResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | BackupSchedule | yes |  |
| `data.enabled` | boolean | yes | Enable scheduled snapshots |
| `data.cron` | string | yes | Five-part cron expression |
| `data.retention_count` | integer | yes | Number of local snapshots to retain |
| `data.next_run_at` | string \| null | yes | Next scheduled run timestamp |

### BackupDestination

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Effective backup directory |
| `is_custom` | boolean | yes | Whether a custom destination is active |
| `writable` | boolean | yes | Whether the daemon can write to this directory |

### BackupDestinationPatch

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Absolute custom backup path, or empty string to reset |

### BackupDestinationResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | BackupDestination | yes |  |
| `data.path` | string | yes | Effective backup directory |
| `data.is_custom` | boolean | yes | Whether a custom destination is active |
| `data.writable` | boolean | yes | Whether the daemon can write to this directory |

### BackupCreateRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `skip_remote` | boolean | no | When true, create only the local snapshot and skip S3 upload |

### BackupResult

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Local backup directory |
| `size_bytes` | integer | yes | Snapshot database size |
| `bookmark_count` | integer | yes | Bookmarks included |
| `created_at` | string | yes | Creation timestamp |
| `remote_url` | string | no | Remote S3 URL when uploaded |

### BackupEntry

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Backup name or remote key |
| `path` | string | yes | Local path or s3:// URI |
| `size_bytes` | integer | yes | Snapshot database size |
| `bookmark_count` | integer | yes | Bookmarks included |
| `created_at` | string | yes | Creation timestamp |
| `source` | "local" \| "remote" | yes | Backup source |

### BackupListResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<BackupEntry> | yes | Backup entries |

### BackupVerifyRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Local backup directory name |

### BackupPackageRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | yes | Local backup directory name |
| `password` | string | yes | Password used to encrypt the package |

### EncryptedBackupPackageRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Absolute encrypted package file path under the configured backup directory |
| `password` | string | yes | Password used to decrypt the package |

### BackupVerificationResult

| Field | Type | Required | Description |
|---|---|---:|---|
| `ok` | boolean | yes | Whether verification succeeded |
| `name` | string | yes | Local backup directory name |
| `path` | string | yes | Local backup directory |
| `checksum_verified` | boolean | yes | Whether checksum verification succeeded |
| `verified_files` | array<string> | yes | Verified files |
| `bookmark_count` | integer | yes | Bookmarks included |
| `created_at` | string | yes | Backup creation timestamp |

### EncryptedBackupPackageResult

| Field | Type | Required | Description |
|---|---|---:|---|
| `path` | string | yes | Encrypted package file path |
| `source_path` | string | yes | Source local backup directory |
| `encrypted` | boolean | yes | Whether the package is encrypted |
| `size_bytes` | integer | yes | Encrypted package size |
| `created_at` | string | yes | Package creation timestamp |

### EncryptedBackupPackageVerificationResult

| Field | Type | Required | Description |
|---|---|---:|---|
| `ok` | boolean | yes | Whether verification succeeded |
| `path` | string | yes | Encrypted package file path |
| `package_encrypted` | boolean | yes | Whether the verified input was encrypted |
| `checksum_verified` | boolean | yes | Whether checksum verification succeeded after decryption |
| `verified_files` | array<string> | yes | Verified files |
| `bookmark_count` | integer | yes | Bookmarks included |
| `created_at` | string | yes | Backup creation timestamp |

### RestoreRequest

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | string | no | Local backup directory name |
| `source` | "remote" \| "encrypted_package" | no | Restore source |
| `key` | string | no | Remote S3 snapshot.db key |
| `path` | string | no | Absolute encrypted package file path under the configured backup directory |
| `password` | string | no | Password used to decrypt the encrypted package |
| `allow_unsafe_no_checksum` | boolean | no | Allow restoring a backup with no checksum file |

### RestoreResult

| Field | Type | Required | Description |
|---|---|---:|---|
| `restored_at` | string | yes | Restore timestamp |
| `bookmark_count` | integer | yes | Restored bookmark count |
| `checksum_verified` | boolean | yes | Whether checksum verification succeeded |
| `rollback_path` | string | yes | Rollback copy directory |
| `restart_required` | boolean | yes | Whether daemon restart is required |

### TimelineEvent

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Timeline event ID |
| `type` | "category_created" \| "category_merged" \| "category_merge_suggested" \| "category_renamed" \| "duplicate_removed" \| "duplicate_flagged" \| "cluster_labeled" \| "suggestion_accepted" \| "suggestion_rejected" | yes | Timeline event type |
| `description` | string | yes | Human-readable event description |
| `metadata` | object | yes | Event metadata |
| `source` | "agent" \| "user" | yes | Event source |
| `created_at` | string | yes | Creation timestamp |

### TimelinePage

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<TimelineEvent> | yes | Timeline events |
| `pagination` | Pagination | yes |  |
| `pagination.total` | integer | yes | Total matching records |
| `pagination.limit` | integer | yes | Applied page size |
| `pagination.offset` | integer | yes | Applied offset |
| `pagination.has_more` | boolean | yes | Whether another page exists |

### Suggestion

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Suggestion ID |
| `bookmarkId` | string \| null | yes | Related bookmark ID |
| `type` | "new_subcategory" \| "merge_categories" \| "duplicate_bookmark" | yes | Suggestion type |
| `value` | string | yes | Human-readable suggestion value |
| `metadata` | object | yes | Suggestion metadata |
| `confidence` | number \| null | yes | Confidence score |
| `status` | "pending" \| "accepted" \| "rejected" | yes | Suggestion status |
| `created_at` | string | yes | Creation timestamp |
| `resolved_at` | string \| null | yes | Resolution timestamp |

### SuggestionsResponse

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | array<Suggestion> | yes | Pending suggestions |
| `meta` | object | yes |  |
| `meta.pending` | integer | yes | Pending suggestion count |

### HealthResponse

| Field | Type | Required | Description |
|---|---|---:|---|
| `status` | "ok" | yes | Health status |
| `version` | string | yes | Daemon package version |
| `uptime` | integer | yes | Process uptime in milliseconds |
| `queueSize` | integer | yes | Queued background jobs |

### UpdateRelease

| Field | Type | Required | Description |
|---|---|---:|---|
| `version` | string | yes | Normalized semantic version |
| `tag` | string | yes | Release tag from the update source |
| `name` | string | yes | Release display name |
| `prerelease` | boolean | yes | Whether the release is marked as a prerelease |
| `published_at` | string | yes | Release publication timestamp |
| `url` | string | yes | Human-readable release URL |

### UpdateCheckResult

| Field | Type | Required | Description |
|---|---|---:|---|
| `current_version` | string | yes | Current packaged Little Imp version |
| `update_available` | boolean | yes | Whether a compatible release is newer than the current version |
| `source` | string | yes | Release source URL used for the check |
| `channel` | "stable" \| "beta" | yes | Applied update channel |
| `latest` | UpdateRelease \| null | yes |  |
| `latest.version` | string | yes | Normalized semantic version |
| `latest.tag` | string | yes | Release tag from the update source |
| `latest.name` | string | yes | Release display name |
| `latest.prerelease` | boolean | yes | Whether the release is marked as a prerelease |
| `latest.published_at` | string | yes | Release publication timestamp |
| `latest.url` | string | yes | Human-readable release URL |

### UpdateCheckResponse

Response data

| Field | Type | Required | Description |
|---|---|---:|---|
| `data` | UpdateCheckResult | yes |  |
| `data.current_version` | string | yes | Current packaged Little Imp version |
| `data.update_available` | boolean | yes | Whether a compatible release is newer than the current version |
| `data.source` | string | yes | Release source URL used for the check |
| `data.channel` | "stable" \| "beta" | yes | Applied update channel |
| `data.latest` | UpdateRelease \| null | yes |  |
| `data.latest.version` | string | yes | Normalized semantic version |
| `data.latest.tag` | string | yes | Release tag from the update source |
| `data.latest.name` | string | yes | Release display name |
| `data.latest.prerelease` | boolean | yes | Whether the release is marked as a prerelease |
| `data.latest.published_at` | string | yes | Release publication timestamp |
| `data.latest.url` | string | yes | Human-readable release URL |

### ExportBookmark

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Bookmark ID |
| `url` | string | yes | Bookmark URL |
| `title` | string \| null | yes | Title |
| `summary` | string \| null | yes | Summary |
| `tags` | array<string> | yes | Tag names |
| `category` | string \| null | yes | Category name |
| `domain` | string | yes | Domain |
| `created_at` | string | yes | Creation timestamp |

### McpErrorResponse

| Field | Type | Required | Description |
|---|---|---:|---|
| `error` | string | yes | MCP failure message |
