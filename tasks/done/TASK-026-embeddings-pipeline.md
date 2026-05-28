# TASK-026: Embeddings Pipeline Integration

**Status:** done
**Priority:** medium
**Phase:** M3
**Area:** backend

## Description

The embed pipeline stage and `embeddings` table exist but the stage is stubbed. This task ensures embeddings are generated after `ai_enriched` status and stored correctly, enabling semantic and hybrid search.

## Work

- Verify the `embed` stage runs after `ai_enriched` in the pipeline flow
- Confirm `getEmbedding()` is correctly wired into the pipeline handler
- Confirm embedding is stored as packed float32 BLOB in `embeddings` table with correct `model` and `dimensions` values
- Handle missing embedding provider gracefully (skip stage, bookmark reaches `indexed` without embedding)
- Ensure `PipelineBadge` in the frontend correctly reflects `indexed` state when embedding is stored
- Add retry logic for transient embedding API failures (exponential backoff)

## Acceptance Criteria

- [x] After `ai_enriched`, pipeline proceeds to `embed` stage when provider is configured
- [x] Embedding row exists in `embeddings` table after successful ingestion
- [x] Bookmark reaches `indexed` status
- [x] When no embedding provider is configured, bookmark still reaches `indexed` (embedding skipped)
- [x] `PipelineBadge` shows `indexed` in the UI
- [~] Transient embedding provider calls retry with backoff inside the provider
      client; exhausted stage failures are user-retriable through the
      reprocess and retry flows from TASK-064 and TASK-065.

## Follow-up Closure Note

Queue-level job failures are retried with exponential backoff, and embedding
provider calls retry transient failures internally. TASK-064 and TASK-065 added
user-triggered recovery for failed pipeline work, including embedding refresh
and retry paths for exhausted provider-stage failures.
