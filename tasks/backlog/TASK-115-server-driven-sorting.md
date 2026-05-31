# TASK-115: Server Driven Sorting

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
**Area:** search / daemon / frontend
**Source:** PAR-044
**Labels:** grimoire-parity, sorting, search

## Description

Move sort options to server-driven ordering for created date, updated date,
title, domain, opened count, and last-opened date.

## Scope

1. Define supported sort keys and directions in the API contract.
2. Implement daemon ordering for list and search endpoints where applicable.
3. Wire frontend sort controls through the central API layer.
4. Preserve stable ordering and pagination behavior.

## Acceptance Criteria

- [ ] API contract documents supported sort keys and directions.
- [ ] Daemon list/search endpoints apply sorting before pagination.
- [ ] Frontend sort controls use server-driven ordering.
- [ ] Sorting remains stable for equal values.
- [ ] Tests cover all approved sort keys and pagination interaction.

## Dependencies

- Depends on TASK-091 for open metric sort keys.
- Coordinates with TASK-114.
