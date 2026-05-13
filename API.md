# Little Imp API Documentation

> API reference for the Little Imp daemon (`littleimpd`)

## Base URL

All API endpoints are relative to: `http://127.0.0.1:3210`

## Authentication

Currently, no authentication is required as the daemon runs locally on the user's machine.

## Response Format

All API responses follow this structure:

```json
{
  "data": "response data or array",
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "has_more": true
  },
  "meta": {
    "mode": "keyword",
    "version": "0.1.0-beta"
  }
}
```

## Error Responses

Errors are returned with appropriate HTTP status codes:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

## Core Endpoints

### Bookmarks

#### List Bookmarks

```http
GET /bookmarks
```

Query parameters:

- `limit` (optional): Number of results to return (default: 20)
- `offset` (optional): Number of results to skip (default: 0)
- `category_id` (optional): Filter by category ID
- `is_pinned` (optional): Filter by pinned status (0 or 1)
- `is_archived` (optional): Filter by archived status (0 or 1)
- `is_trashed` (optional): Filter by trash status (0 or 1)
- `domain` (optional): Filter by domain
- `tag` (optional): Filter by tag

Response: Array of bookmark objects

#### Get Bookmark by ID

```http
GET /bookmarks/:id
```

Response: Single bookmark object

#### Create Bookmark

```http
POST /bookmarks
```

Request body:

```json
{
  "url": "https://example.com",
  "title": "Example Site",
  "category_id": "optional-category-id",
  "notes": "Optional notes"
}
```

Response: Created bookmark object

#### Update Bookmark

```http
PUT /bookmarks/:id
```

Request body (all fields optional):

```json
{
  "title": "Updated Title",
  "category_id": "new-category-id",
  "is_pinned": 1,
  "is_archived": 0,
  "notes": "Updated notes"
}
```

#### Delete Bookmark (Soft Delete)

```http
DELETE /bookmarks/:id
```

Moves bookmark to trash (soft delete).

#### Bookmark Actions

**Pin/Unpin:**

```http
POST /bookmarks/:id/pin
POST /bookmarks/:id/unpin
```

**Archive/Unarchive:**

```http
POST /bookmarks/:id/archive
POST /bookmarks/:id/unarchive
```

**Mark as Read/Unread:**

```http
POST /bookmarks/:id/mark-read
POST /bookmarks/:id/mark-unread
```

**Add/Remove Tags:**

```http
POST /bookmarks/:id/tags
DELETE /bookmarks/:id/tags/:tag
```

Request body for adding tags:

```json
{
  "tags": ["tag1", "tag2"]
}
```

### Search

#### Search Bookmarks

```http
GET /search
```

Query parameters:

- `q` (optional): Search query
- `mode` (optional): Search mode - `keyword`, `semantic`, or `hybrid` (default: `keyword`)
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Results offset (default: 0)
- `domain` (optional): Filter by domain
- `tag` (optional): Filter by tag

### Categories

#### List Categories

```http
GET /categories
```

Response: Hierarchical category tree

#### Create Category

```http
POST /categories
```

Request body:

```json
{
  "name": "Development",
  "parent_id": "optional-parent-id"
}
```

#### Update Category

```http
PUT /categories/:id
```

Request body:

```json
{
  "name": "Updated Name",
  "parent_id": "new-parent-id"
}
```

#### Delete Category

```http
DELETE /categories/:id
```

### Tags

#### List Tags

```http
GET /tags
```

Response: Array of tag objects with usage counts

### Domains

#### List Domains

```http
GET /domains
```

Response: Array of domain objects with bookmark counts

### Timeline

#### Get Timeline

```http
GET /timeline
```

Query parameters:

- `limit` (optional): Number of events (default: 50)
- `offset` (optional): Events offset (default: 0)

Response: Array of timeline events

### Suggestions

#### Get AI Suggestions

```http
GET /suggestions
```

Response: Array of AI-generated suggestions for organization

#### Accept/Reject Suggestion

```http
POST /suggestions/:id/accept
POST /suggestions/:id/reject
```

### Import/Export

#### Import Bookmarks

```http
POST /import
```

Content-Type: `multipart/form-data`

Form data:

- `file`: Netscape HTML bookmark file

Response:

```json
{
  "importId": "unique-import-id",
  "total": 42,
  "warnings": 2,
  "progressUrl": "/import/progress/:importId"
}
```

#### Check Import Progress

```http
GET /import/progress/:importId
```

#### Export Bookmarks

```http
GET /export
```

Query parameters:

- `format` (optional): Export format - `json` or `csv` (default: `json`)
- `q` (optional): Search query to filter exported bookmarks
- `category_id` (optional): Filter by category
- `tag` (optional): Filter by tag

### Settings

#### Get Settings

```http
GET /settings
```

Response: Current settings object

Secrets are redacted as `"***"`. The `runtime` block reports effective
capabilities without exposing API keys.

```json
{
  "data": {
    "ai": {
      "provider": "openai",
      "openai": {
        "api_key": "***",
        "model": "gpt-4o-mini"
      },
      "ollama": {
        "base_url": "http://localhost:11434",
        "model": "llama3"
      },
      "embeddings": {
        "provider": "openai",
        "model": "text-embedding-3-small"
      }
    },
    "runtime": {
      "llm": {
        "enabled": true,
        "provider": "openai",
        "model": "gpt-4o-mini",
        "base_url": "https://api.openai.com/v1"
      },
      "embeddings": {
        "enabled": true,
        "provider": "openai",
        "model": "text-embedding-3-small",
        "base_url": "https://api.openai.com/v1"
      },
      "capabilities": {
        "enrichment": true,
        "semantic_search": true,
        "related_bookmarks": true,
        "organization_agent": true
      }
    }
  }
}
```

#### Update Settings

```http
PUT /settings
```

Request body:

```json
{
  "ai": {
    "provider": "ollama",
    "ollama": {
      "base_url": "http://localhost:11434",
      "model": "llama3"
    },
    "embeddings": {
      "provider": "ollama",
      "model": "nomic-embed-text"
    }
  }
}
```

`PUT /settings` accepts partial nested patches. Persisted settings are the
runtime source of truth for ingestion, semantic search, related bookmarks, MCP
search, and organization suggestions. Environment variables are fallback
defaults when a value has not been persisted. Redacted secret placeholders from
`GET /settings` are ignored on save so clients can round-trip settings safely.

### Backup

#### Create Backup

```http
POST /backup
```

Creates a new backup snapshot.

Response:

```json
{
  "path": "/path/to/backup/directory",
  "size_bytes": 1048576,
  "bookmark_count": 150,
  "created_at": "2026-03-28T12:00:00Z"
}
```

#### List Backups

```http
GET /backup/list
```

Response: Array of backup metadata

#### Restore from Backup

```http
POST /restore
```

Request body:

```json
{
  "name": "backup-directory-name"
}
```

### Health

#### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "version": "0.1.0-beta",
  "uptime": 3600,
  "queueSize": 0
}
```

## Data Types

### Bookmark Object

```json
{
  "id": "bookmark-uuid",
  "url": "https://example.com",
  "domain": "example.com",
  "title": "Example Site",
  "description": "Site description",
  "status": "indexed",
  "category_id": "category-uuid",
  "category": {
    "id": "category-uuid",
    "name": "Development"
  },
  "favicon_url": "https://example.com/favicon.ico",
  "screenshot_url": null,
  "is_pinned": 0,
  "is_archived": 0,
  "is_trashed": 0,
  "trashed_at": null,
  "read_at": null,
  "notes": "Personal notes",
  "tags": ["tag1", "tag2"],
  "word_count": 500,
  "reading_time": 2,
  "created_at": "2026-03-28T12:00:00Z",
  "updated_at": "2026-03-28T12:00:00Z"
}
```

### Category Object

```json
{
  "id": "category-uuid",
  "name": "Development",
  "parent_id": "parent-category-uuid",
  "bookmark_count": 25,
  "created_at": "2026-03-28T12:00:00Z",
  "updated_at": "2026-03-28T12:00:00Z"
}
```

### Search Result Object

```json
{
  "id": "bookmark-uuid",
  "url": "https://example.com",
  "title": "Example Site",
  "description": "Site description",
  "domain": "example.com",
  "tags": ["tag1", "tag2"],
  "category": "Development",
  "is_pinned": 0,
  "is_archived": 0,
  "status": "indexed",
  "created_at": "2026-03-28T12:00:00Z"
}
```

## Error Codes

| HTTP Status | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

## Rate Limiting

Currently, no rate limiting is implemented as the daemon runs locally.

## Version History

- **v0.1.0-beta**: Initial API documentation

## Examples

### Complete Workflow: Add and Search

```bash
# Add a bookmark
curl -X POST http://127.0.0.1:3210/bookmarks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/goniszewski/little-imp",
    "title": "Little Imp - Local-first bookmark manager"
  }'

# Wait for processing (status will change from "saved" to "indexed")
# Then search for it
curl "http://127.0.0.1:3210/search?q=little+imp&mode=keyword"
```

### Category Management

```bash
# Create a category
curl -X POST http://127.0.0.1:3210/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Open Source Projects"}'

# List categories
curl http://127.0.0.1:3210/categories
```

### Backup Operations

```bash
# Create a backup
curl -X POST http://127.0.0.1:3210/backup

# List available backups
curl http://127.0.0.1:3210/backup/list

# Restore from a backup (replace with actual backup name)
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"name": "backup-2026-03-28-120000"}'
```

---

*This API documentation is auto-generated from the codebase. For the most up-to-date information, refer to the source code in `daemon/src/routes/`.*
