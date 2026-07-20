# TASK-004: Content Extraction Pipeline

**Status:** backlog
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

- [ ] Each stage updates bookmark status field
- [ ] Failures are logged to `jobs` table with error message and retry count
- [ ] Job worker picks up failed jobs for retry with exponential backoff
- [ ] Readability extraction works for general articles
- [ ] GitHub extractor fetches README via API (no scraping)
- [ ] StackOverflow extractor pulls question + top accepted answer
- [ ] All extractors strip navigation, ads, cookie banners
- [ ] Extracted content stored in `bookmark_content` table
