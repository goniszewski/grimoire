# TASK-006: HTML Bookmark Import (Netscape Format)

**Status:** backlog
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

- [ ] Parses Chrome, Firefox, Safari, Edge export formats
- [ ] Handles nested folders → maps to category hierarchy
- [ ] Deduplicates URLs already in library
- [ ] Shows real-time import progress (SSE or polling endpoint)
- [ ] Large imports (1000+ bookmarks) don't block the API
- [ ] Import jobs are batched and processed by background worker
- [ ] Frontend import dialog connects to this endpoint (replaces mock)
