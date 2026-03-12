# TASK-015: Domains Page — Real Data

**Status:** done
**Priority:** low
**Phase:** v0-alpha
**Area:** frontend / backend

## Description

The `Domains.tsx` page exists in the frontend but uses mock data. Wire it to a real domains API endpoint.

## Backend Endpoint Needed

- `GET /domains` — list all domains with bookmark counts, ordered by count desc

## Response

```json
[
  { "domain": "github.com", "count": 42, "favicon_url": "..." },
  { "domain": "stackoverflow.com", "count": 31, "favicon_url": "..." }
]
```

## Frontend

- Domain list fetched from API
- Click on domain filters bookmark list by that domain
- Favicon loaded from `https://www.google.com/s2/favicons?domain=<domain>`

## Acceptance Criteria

- [x] Domains API endpoint returns correct counts
- [x] Domains page fetches real data
- [x] Clicking domain navigates to filtered search results
- [x] Favicons load with fallback for missing icons
