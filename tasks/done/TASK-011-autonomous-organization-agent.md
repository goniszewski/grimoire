# TASK-011: Autonomous Organization Agent

**Status:** done
**Priority:** low
**Phase:** v0.2
**Area:** backend / ai / agent

## Description

Implement the periodic AI agent that analyzes the library to detect clusters, suggest new subcategories, merge categories, and detect duplicates.

## Agent Tasks

1. **Cluster detection** — group semantically similar bookmarks using embeddings (k-means or HDBSCAN)
2. **New subcategory suggestion** — if a cluster lacks a matching category, suggest creating one
3. **Category merge suggestion** — if two categories are very similar, suggest merging
4. **Duplicate detection** — find bookmarks with nearly identical URLs or content

## Confidence Rules

```
confidence ≥ 0.9 → auto apply
confidence < 0.9 → add to Review Queue as suggestion
```

## Review Queue API

- `GET /suggestions` — list pending agent suggestions
- `POST /suggestions/:id/accept` — apply suggestion
- `POST /suggestions/:id/reject` — dismiss suggestion

## Acceptance Criteria

- [x] Agent runs on a configurable schedule (default: daily, `AGENT_INTERVAL_MS` env var)
- [x] Clustering only activates when library size > 20 bookmarks (cold start rule)
- [x] Suggestions stored in `agent_suggestions` table
- [x] High-confidence actions auto-applied and logged to timeline
- [x] Review Queue visible in frontend
- [x] Duplicate detection flags bookmarks with > 90% content similarity
- [x] Agent runs do not block the API
