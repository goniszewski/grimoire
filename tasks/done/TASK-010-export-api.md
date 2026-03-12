# TASK-010: Export API (JSON & CSV)

**Status:** done
**Priority:** low
**Phase:** v0-alpha
**Area:** backend / api

## Description

Implement export endpoints to download the bookmark library in JSON or CSV format.

## Endpoints

- `GET /export?format=json` — export all bookmarks as JSON
- `GET /export?format=csv` — export all bookmarks as CSV
- Optional: `?filter=<same filters as search>` to export a subset

## JSON Format

```json
[
  {
    "id": "...",
    "url": "...",
    "title": "...",
    "summary": "...",
    "tags": ["..."],
    "category": "...",
    "domain": "...",
    "created_at": "..."
  }
]
```

## CSV Format

Columns: id, url, title, summary, tags (semicolon-joined), category, domain, created_at

## Acceptance Criteria

- [x] JSON export returns valid JSON array
- [x] CSV export includes headers row
- [x] Large exports (10k+ bookmarks) streamed without memory issues
- [x] Frontend ExportMenu connects to these endpoints (replaces mock)
- [x] Content-Disposition header triggers file download in browser
