# TASK-006: HTML Bookmark Import (Netscape Format)

**Status:** done
**Priority:** high
**Phase:** v0-alpha
**Area:** backend / import

## Description

Implement import from Netscape Bookmark HTML format (exported by Chrome, Firefox, Safari, Edge).

## API Endpoint

- `POST /import` — multipart form upload of `.html` bookmark file

## Behavior

- Parse Netscape HTML bookmark structure
- Extract URL, title, add_date from each `<A>` tag
- Import folders as category hints
- Enqueue each bookmark as a pipeline job (deduplication by URL)
- Return import summary: total found, already existing, queued

## Acceptance Criteria

- [x] Parses Chrome, Firefox, Safari, Edge export formats
- [x] Handles nested folders → maps to category hierarchy
- [x] Deduplicates URLs already in library
- [x] Shows real-time import progress (SSE or polling endpoint)
- [x] Large imports (1000+ bookmarks) don't block the API
- [x] Import jobs are batched and processed by background worker
- [x] Frontend import dialog connects to this endpoint (replaces mock)
