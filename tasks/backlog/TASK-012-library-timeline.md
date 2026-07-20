# TASK-012: Library Evolution Timeline

**Status:** backlog
**Priority:** low
**Phase:** v0.2
**Area:** backend / api

## Description

Implement timeline recording of all structural changes to the library (category creation, merges, agent actions).

## API

- `GET /timeline` — list timeline events, newest first

## Event Types

- `category_created`
- `category_merged`
- `category_renamed`
- `duplicate_removed`
- `cluster_labeled`

## Event Schema

```json
{
  "id": "...",
  "type": "category_created",
  "description": "Created subcategory: AI → Retrieval Augmented Generation",
  "metadata": { "category_id": "...", "parent_id": "..." },
  "source": "agent | user",
  "created_at": "..."
}
```

## Acceptance Criteria

- [ ] All agent auto-actions write to timeline
- [ ] Manual category changes also recorded
- [ ] Timeline paginated (newest first)
- [ ] Frontend timeline view reads from this endpoint
