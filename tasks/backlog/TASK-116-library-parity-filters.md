# TASK-116: Library Parity Filters

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
**Area:** search / filters / frontend / daemon
**Source:** PAR-045
**Labels:** grimoire-parity, filters, search

## Description

Add filters for unread/read, pinned/starred, read-later, opened count, and
last-opened date after the supporting fields are approved.

## Scope

1. Define filter query parameters and validation in the API contract.
2. Implement daemon filtering for list and search endpoints.
3. Add dense frontend filter controls that combine with existing filters.
4. Preserve URL/local state behavior and reset affordances.

## Acceptance Criteria

- [ ] Read/unread, pinned/starred, read-later, opened count, and last-opened
      filters are available once fields exist.
- [ ] Filters apply server-side before pagination.
- [ ] Filter combinations work with search, category, tag, domain, and date.
- [ ] UI makes active filters and reset behavior clear.
- [ ] Tests cover individual and combined filters.

## Dependencies

- Depends on TASK-089, TASK-091, and TASK-114.
