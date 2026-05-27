# TASK-065: Pipeline Failure Recovery UX

**Phase:** MVP readiness
**Priority:** high
**Status:** done
**Area:** frontend / daemon / pipeline

## Description

Make ingestion and enrichment failures actionable. A bookmark that fails fetch,
extraction, AI enrichment, embedding, or indexing should show enough information
for the user to understand what happened and retry the failed work.

## Scope

1. Review current pipeline status and error fields exposed by the daemon.
2. Add or complete API support for retrying one bookmark's failed pipeline work.
3. Add a bulk retry path for failed jobs if needed for imported libraries.
4. Display last failure stage, message, and retry state in bookmark detail and
   relevant lists.
5. Add UI actions for retry, dismissing non-blocking errors, and opening
   provider settings when the failure is configuration-related.
6. Add tests for failed fetch, failed extraction fallback, failed AI provider,
   failed embedding provider, retry success, and retry exhaustion.

## Acceptance Criteria

- [x] Failed pipeline states are visible from the bookmark detail UI.
- [x] Users can retry failed work for a bookmark without deleting and re-adding
      it.
- [x] Configuration-related failures link to Settings.
- [x] Bulk retry is available for imported or accumulated failures when
      practical.
- [x] Retry actions are idempotent and do not create duplicate bookmarks.
- [x] Frontend and daemon tests cover the failure recovery paths.

## Dependencies

- Coordinates with TASK-064 if reprocess and retry share job enqueueing logic.

## Notes

- This task should avoid turning transient provider outages into destructive
  bookmark state changes.
