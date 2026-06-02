# TASK-131: GitHub Issues Extractor

**Phase:** Performance and polish
**Priority:** low (P3)
**Status:** backlog
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

- [ ] A saved GitHub issues URL triggers the `github-issues` extractor.
- [ ] Issue title, body, state, labels, and top comments are stored in the bookmark content.
- [ ] Unauthenticated requests fall back cleanly with a rate-limit warning in the pipeline log.
- [ ] A `GITHUB_TOKEN` setting increases rate limits when configured.
- [ ] Non-issues GitHub URLs (PRs, discussions, repos) use existing GitHub extractors.
- [ ] Unit tests cover success, 404, and rate-limit responses.
- [ ] All existing pipeline tests continue to pass.

## Dependencies

- Existing extractor framework (`daemon/src/pipeline/extractor.ts`) — complete.
- Existing pipeline job/retry infrastructure — complete.

## Notes

- This is the last extractor type listed in the PRD that is not yet implemented.
- The GitHub REST API returns issue bodies in Markdown — no additional rendering step needed.
- Consider caching the API response to avoid re-fetching on pipeline retries.
- Rate limits: unauthenticated = 60 requests/hour; authenticated = 5,000/hour. Document this in the feature.
