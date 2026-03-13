# TASK-027: Semantic & Hybrid Search

**Status:** done
**Priority:** medium
**Phase:** M3
**Area:** backend / frontend

## Description

Wire up `mode=semantic` and `mode=hybrid` on `GET /search`. Both are currently stubbed. Also implement `GET /bookmarks/:id/related` for nearest-neighbor lookup.

## Backend

**Semantic search (`mode=semantic`):**
- Generate query embedding from search term
- Run cosine similarity against all rows in `embeddings` table using `sqlite-vec`
- Return bookmarks ordered by similarity score

**Hybrid search (`mode=hybrid`):**
- Run FTS5 BM25 keyword search and cosine similarity in parallel
- Merge results using PRD weights: `keyword * 0.6 + vector * 0.3 + recency * 0.1`
- Deduplicate results by bookmark ID
- Apply same filters as keyword search (tag, domain, category, date)

**Related bookmarks (`GET /bookmarks/:id/related`):**
- Fetch embedding for the given bookmark
- Return top-N nearest neighbors (default N=5) excluding the bookmark itself

## Frontend

- Search mode toggle already exists in `SearchBar` — confirm it sends correct `mode` param
- "Related bookmarks" section in `BookmarkDetailContent` — calls `/bookmarks/:id/related`

## Acceptance Criteria

- [x] `mode=semantic` returns results ranked by vector similarity
- [x] `mode=hybrid` blends keyword and vector scores per PRD weights
- [x] Filters (tag, domain, category, date) apply to all search modes
- [x] `/bookmarks/:id/related` returns up to 5 similar bookmarks
- [x] Graceful fallback when bookmark has no embedding: semantic returns empty, hybrid falls back to keyword-only
