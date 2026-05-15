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

- Fetch failure → bookmark stays at `saved` status, retry later
- Extraction failure → fallback to page title only
- LLM failure → bookmark usable without enrichment, retry later
- Embedding failure → retry later

## Acceptance Criteria

- [x] Each stage updates bookmark status field
- [x] Failures are logged and job worker handles retry (queue mechanism already in place)
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

Final status remains `done`; the task file is already in `tasks/done/`.
