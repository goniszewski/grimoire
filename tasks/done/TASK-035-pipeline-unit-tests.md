# TASK-035: Pipeline Stage Unit Tests

**Status:** done
**Priority:** medium
**Phase:** M4
**Area:** backend / testing

## Description

Unit tests for each extraction pipeline stage using Bun's test runner. These are the only remaining unchecked M4 items — all other daemon tests are done (TASK-030).

## Test scenarios

**Fetch stage (`daemon/src/pipeline/stages/fetch.ts` or equivalent)**
- Happy path: returns HTML body for a valid mocked URL
- Non-200 response → stage marks job as `failed` with reason
- Network timeout → stage marks job as `failed`
- Redirects followed correctly

**Extract stage**
- Extracts title, description, main text content from a static HTML fixture
- Falls back gracefully when no `<title>` or `<meta description>` present
- Handles malformed HTML without throwing

**AI enrich stage**
- Calls the LLM client with the extracted content
- Parses the LLM JSON response into the expected fields (tags, summary, category hint)
- Handles LLM returning invalid JSON → marks job `ai_failed`, does not crash pipeline
- Skipped entirely when `AI_PROVIDER` is unset (no API key)

**Embed stage**
- Calls embedding API and stores a float32 BLOB in `embeddings` table
- Skipped when `EMBEDDING_API_KEY` is unset
- Handles embedding API error → marks job `embed_failed`, pipeline continues to `indexed`

**Index stage**
- Updates FTS5 index after content is set
- Verifies bookmark is returned by FTS search after indexing

## Setup

- Mock all external HTTP calls (no real network)
- Use in-memory SQLite via existing test helpers
- Each stage test file is independent — no shared mutable state

## Acceptance Criteria

- [x] All stage unit tests pass with `bun test`
- [x] Each stage is tested in isolation (mocked dependencies)
- [x] No real HTTP requests made
- [x] Tests complete in < 5 seconds
