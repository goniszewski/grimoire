# TASK-005: Keyword Search (FTS5)

**Status:** backlog
**Priority:** high
**Phase:** v0-alpha
**Area:** backend / search

## Description

Implement full-text keyword search using SQLite FTS5 with BM25 ranking.

## Search API

- `GET /search?q=<query>&tag=&domain=&category=&date_from=&date_to=&limit=&offset=`

## Indexed Fields

- title (weight: high)
- summary (weight: medium)
- tags (weight: medium)
- extracted content (weight: low)

## Behavior

- Results ranked by FTS5 BM25 score
- Supports boolean operators: AND, OR, NOT
- Supports phrase search with quotes
- Filters applied before ranking
- Returns matched field highlights (snippet)

## Acceptance Criteria

- [ ] FTS5 virtual table created with porter tokenizer
- [ ] Search endpoint returns results ordered by relevance
- [ ] Filter params (tag, domain, category, date) applied correctly
- [ ] Snippet highlights matching terms in title/summary
- [ ] Empty query returns all bookmarks sorted by date
- [ ] Response time < 100ms for libraries up to 10,000 bookmarks
- [ ] FTS index updated after each pipeline completion
