# TASK-017: AI Palette / Command Palette Integration

**Status:** backlog
**Priority:** medium
**Phase:** v0-beta
**Area:** frontend

## Description

The `AIPalette.tsx` component exists in the frontend. Wire it to the real search and AI endpoints to support natural language queries.

## Features

- Natural language search ("bookmarks about vector databases for RAG")
- Quick bookmark add from palette
- Navigate to category/tag from palette

## Acceptance Criteria

- [ ] Palette queries `GET /search?q=<query>&mode=semantic` for NL queries
- [ ] Results shown in palette with title + domain
- [ ] Keyboard navigation through results (already exists in UI)
- [ ] Selecting a result opens BookmarkDetail
- [ ] "Add bookmark" action in palette triggers AddBookmarkDialog
