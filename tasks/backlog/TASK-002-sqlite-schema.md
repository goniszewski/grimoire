# TASK-002: SQLite Database Schema

**Status:** backlog
**Priority:** high
**Phase:** v0-alpha
**Area:** backend / database

## Description

Design and implement the SQLite database schema with FTS5 and sqlite-vec extensions.

## Tables

- `bookmarks` — core bookmark record (url, title, status, timestamps)
- `bookmark_content` — extracted page content (1:1 with bookmark)
- `tags` — tag definitions
- `bookmark_tags` — many-to-many join
- `categories` — hierarchical category tree
- `embeddings` — vector embeddings per bookmark (sqlite-vec)
- `jobs` — pipeline job queue
- `agent_suggestions` — pending AI organization suggestions
- `timeline_events` — structural change history

## Acceptance Criteria

- [ ] Schema migrations in versioned files
- [ ] FTS5 virtual table indexes title, summary, tags, extracted content
- [ ] sqlite-vec extension loaded and embeddings table functional
- [ ] Bookmark status enum: `saved | fetched | extracted | ai_enriched | indexed`
- [ ] Foreign key constraints enforced
- [ ] Indexes on common query paths (domain, category, date)
- [ ] Seed script for development with sample data
