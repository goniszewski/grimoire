# TASK-004: Content Extraction Pipeline

**Status:** done
**Priority:** high
**Phase:** v0-alpha
**Area:** backend / pipeline

## Description

Implement the multi-stage content extraction pipeline that runs after a bookmark is saved.

## Pipeline Stages

1. **fetch** — HTTP fetch page with proper user-agent, follow redirects, timeout handling
2. **extract** — strategy-based extraction depending on source type
3. **ai_enrich** — LLM call for summary + tags + category (TASK-007)
4. **embed** — generate and store embedding vector (TASK-008)
5. **index** — update FTS5 search index

## Extraction Strategies

| Source | Strategy |
| ------ | --------- |
| Blog / article | Readability extraction |
| GitHub repository | README + repo metadata via GitHub API |
| StackOverflow | Question + accepted answer extraction |
| Documentation | Main content area extraction |
| Fallback | Readability |

## Failure Behavior

- Fetch failure -> bookmark stays at `saved` status and the durable queue
  retries the job.
- Extraction failure -> fallback to page title only.
- LLM failure -> provider calls retry transient failures internally; bookmark is
  usable without enrichment if the stage ultimately fails.
- Embedding failure -> provider calls retry transient failures internally;
  bookmark is indexed without a semantic vector if the stage ultimately fails.

## Acceptance Criteria

- [x] Each stage updates bookmark status field
- [x] Thrown job failures are logged and job worker handles retry (queue mechanism already in place)
- [x] Job worker picks up failed jobs for retry with exponential backoff (requires SQLite-backed queue)
- [x] Readability extraction works for general articles
- [x] GitHub extractor fetches README via API (no scraping)
- [x] StackOverflow extractor pulls question + top accepted answer
- [x] All extractors strip navigation, ads, cookie banners
- [x] Extracted content stored in `bookmark_content` table

## Completion Note

SQLite-backed queue persistence and exponential backoff retries were added after
the original task was marked done. The daemon now constructs `JobQueue` with the
application database, failed jobs are rescheduled until `max_attempts`, and
`daemon/src/test/queue.test.ts` covers pending-job restoration, interrupted
running-job recovery after daemon restart, and retry timing.

TASK-058 review update: optional LLM and embedding stages now retry transient
provider calls inside their provider clients, but a provider stage that
ultimately fails is non-fatal and does not enqueue a targeted durable retry.
Targeted reprocess, re-embed, and failed-stage recovery are tracked by TASK-064
and TASK-065.

Final status remains `done`; the task file is already in `tasks/done/`.
