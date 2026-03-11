# TASK-002: SQLite Database Schema

**Status:** done
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

- [x] Schema migrations in versioned files
- [x] FTS5 virtual table indexes title, summary, tags, extracted content
- [x] sqlite-vec extension loaded and embeddings table functional (stored as BLOB; dynamic extension loading blocked by Bun's bundled SQLite — forward-compatible schema in place)
- [x] Bookmark status enum: `saved | fetched | extracted | ai_enriched | indexed`
- [x] Foreign key constraints enforced
- [x] Indexes on common query paths (domain, category, date)
- [x] Seed script for development with sample data
