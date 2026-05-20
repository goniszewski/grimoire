# TASK-064: Library Reprocess and Re-Embed Jobs

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
**Area:** daemon / pipeline / settings

## Description

Add user-triggered reprocessing for existing bookmarks. After users change AI or
embedding providers, fix failed jobs, or import a large library, they need a
safe way to re-run extraction, AI enrichment, embeddings, and indexing without
manually resaving each URL.

## Scope

1. Define reprocess modes: failed only, selected bookmark, all bookmarks, and
   embeddings only.
2. Add daemon job enqueueing for reprocess operations.
3. Preserve user-edited title, tags, category, and notes unless the user opts
   into replacing AI-generated fields.
4. Add API contract entries and generated docs.
5. Add CLI or Settings controls for the supported MVP modes.
6. Show progress and failure counts in the UI.
7. Add tests for enqueueing, field preservation, provider changes, and retry
   behavior.

## Acceptance Criteria

- [ ] Users can re-run failed pipeline work without creating duplicate
      bookmarks.
- [ ] Users can regenerate embeddings after changing embedding provider or
      model.
- [ ] Reprocessing preserves manual edits by default.
- [ ] Reprocess jobs are durable and survive daemon restart.
- [ ] API docs and frontend types are regenerated from the source contract.
- [ ] Focused daemon and frontend tests cover the new behavior.

## Notes

- This closes a practical MVP gap that appears after multi-provider AI support:
  provider settings can change, but existing library data needs a recovery path.
