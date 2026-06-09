# TASK-132: Large-Library Hybrid Search Performance

**Phase:** Performance and polish
**Priority:** low (P3)
**Status:** backlog
**Area:** daemon / search / performance

## Description

Profile and optimize the hybrid search path for libraries with 10K+ bookmarks. The current performance benchmarks use a 2K bookmark fixture. Extend coverage and address bottlenecks that appear at scale.

## Scope

1. **Profile the search path at scale:**
   - Use the existing `npm run test:performance` infrastructure as a base
   - Generate a 10K-bookmark fixture with realistic distributions across categories, tags, domains, read states, and dates
   - Profile: FTS5 query time, filter application (tag/domain/category/date), hybrid score computation, pagination with deep offsets
   - Identify bottlenecks using Bun's built-in profiler or manual timing

2. **Address identified bottlenecks:**
   - **FTS5 query plan tuning:** Add `EXPLAIN QUERY PLAN` coverage for common query patterns; add covering indexes if needed
   - **Aggregate query optimization:** If `GET /aggregates` queries become slow at 10K, consider materialized counts or cached summary tables (trade off against write cost)
   - **Pagination stability:** Confirm cursor-based or offset pagination produces consistent results under concurrent bookmark mutations
   - **Filter join order:** Verify SQLite uses efficient join order for multi-filter queries (e.g., tag filter + category filter + date range)

3. **Extend the performance test suite:**
   - Add a 10K-bookmark scenario to `npm run test:performance`
   - Set realistic budgets: first page ≤1s, deep pagination ≤1s, keyword search ≤1.5s, category filter ≤1s, tag filter ≤1s
   - Add a regression CI check that fails when budgets are exceeded (separate from the fast main test suite)
   - Document the current vs optimized query plans in `docs/performance.md`

4. **Document scaling expectations:**
   - Update `docs/performance.md` with expected query times for 1K, 10K, and 50K libraries
   - Use sqlite-vec (TASK-130) as the baseline vector-search path when extension
     loading is available
   - Document any remaining fallback-mode embedding scan limitation for hosts
     without sqlite-vec support

## Acceptance Criteria

- [ ] 10K-bookmark performance profile is recorded in `docs/performance.md`.
- [ ] Identified bottlenecks are either optimized or documented as known limitations with expected resolution path.
- [ ] `npm run test:performance` runs clean against the 10K fixture within defined budgets.
- [ ] Existing search and filter tests continue to pass.

## Dependencies

- TASK-130 (sqlite-vec vector index) — complete; use its vector benchmark as
  the baseline for semantic and hybrid vector-nearest-neighbor behavior.
- Existing `npm run test:performance` infrastructure — complete.

## Notes

- Do not over-optimize preemptively. Profile first, then optimize only the bottlenecks that show up at 10K.
- FTS5 with a 10K-row table of article-sized content is usually fast. The likely bottlenecks are: filter joins, aggregate counts, and deep-offset pagination.
- TASK-130 keeps BLOB scanning as an optional-runtime fallback; TASK-132 should
  profile both the sqlite-vec path and fallback mode when documenting 10K search
  expectations.
