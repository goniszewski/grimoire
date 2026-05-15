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

- [ ] After `ai_enriched`, pipeline proceeds to `embed` stage when provider is configured
- [ ] Embedding row exists in `embeddings` table after successful ingestion
- [ ] Bookmark reaches `indexed` status
- [ ] When no embedding provider is configured, bookmark still reaches `indexed` (embedding skipped)
- [ ] `PipelineBadge` shows `indexed` in the UI
- [ ] Transient failures are retried with backoff
