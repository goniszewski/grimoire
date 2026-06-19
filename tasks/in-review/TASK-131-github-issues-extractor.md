# TASK-131: GitHub Issues Extractor

**Phase:** Performance and polish
**Priority:** low (P3)
**Status:** in-review
**Area:** daemon / pipeline / extraction

## Description

Add a `github-issues` extractor to the ingestion pipeline. When a saved URL matches a GitHub issues page (`github.com/*/*/issues/*`), extract the issue title, body, status (open/closed), labels, and top comments using the GitHub REST API. This fills the last documented extractor gap from the PRD.

## Scope

1. **Create the extractor (`daemon/src/pipeline/extractors/github-issues.ts`):**
   - Match URL pattern: `https://github.com/{owner}/{repo}/issues/{number}`
   - Use the GitHub REST API to fetch:
     - Issue title, body, state (open/closed), labels, created/updated dates
     - Top N comments (configurable, default 10)
   - If `GITHUB_TOKEN` is configured in settings, use it for authenticated requests (higher rate limits)
   - Fall back to unauthenticated requests (60/hr limit — document this)
   - Store the issue body as the main extracted content, with labels and metadata in the bookmark content JSON

2. **Register in the pipeline:**
   - Add the extractor to the existing extractor registry in `daemon/src/pipeline/extractor.ts`
   - Add URL pattern matching before the general readability extractor (more specific = higher priority)

3. **Content enrichment:**
   - Include issue state and labels as tags (e.g., `#bug`, `#enhancement`)
   - Include the repository name (`owner/repo`) as a metadata field
   - Include issue author and assignees in metadata

4. **Tests:**
   - Unit tests with mocked GitHub API responses (success, 404, rate-limited)
   - Integration test against a real public GitHub issue URL (smoke, with a long timeout)

## Acceptance Criteria

- [x] A saved GitHub issues URL triggers the `github-issues` extractor.
- [x] Issue title, body, state, labels, and top comments are stored in the bookmark content.
- [x] Unauthenticated requests fall back cleanly with a rate-limit warning in the pipeline log.
- [x] A `GITHUB_TOKEN` setting increases rate limits when configured.
- [x] Non-issues GitHub URLs (PRs, discussions, repos) use existing GitHub extractors.
- [x] Unit tests cover success, 404, and rate-limit responses.
- [x] All existing pipeline tests continue to pass.

## Dependencies

- Existing extractor framework (`daemon/src/pipeline/extractor.ts`) — complete.
- Existing pipeline job/retry infrastructure — complete.

## Notes

- This is the last extractor type listed in the PRD that is not yet implemented.
- The GitHub REST API returns issue bodies in Markdown — no additional rendering step needed.
- Consider caching the API response to avoid re-fetching on pipeline retries.
- Rate limits: unauthenticated = 60 requests/hour; authenticated = 5,000/hour. Document this in the feature.

## Work Notes

- June 9, 2026: Implemented a dedicated `github-issues` extractor and routed
  `github.com/{owner}/{repo}/issues/{number}` URLs before the broader GitHub
  repository extractor.
- The extractor fetches issue metadata and top comments through the GitHub REST
  API, uses `GITHUB_TOKEN` when present, and emits a clear rate-limit error
  recommending `GITHUB_TOKEN` when unauthenticated quota is exhausted.
- Extended extraction results with optional generated tags and wired the
  pipeline to persist those tags during normal ingest. GitHub issue labels now
  become bookmark tags and participate in the existing FTS tag index.
- Updated README, overview, and PRD extraction docs, then added the TASK-131
  runtime-flow report under `docs/task-reports/2026/06/`.
- Verification:
  - `cd daemon && bun test src/test/pipeline/github-issues.test.ts`
  - `cd daemon && bun test src/test/pipeline/extract.test.ts src/test/pipeline/github-issues.test.ts`
  - `cd daemon && bun run check`
  - `npm run test:daemon`
  - `npm run lint` (passes with the existing React fast-refresh warnings)
  - `npm run type-check`
  - Live smoke: `extractFromGitHubIssue("https://github.com/microsoft/TypeScript/issues/1", 1)` returned issue title, author, tags, body, and comments.
