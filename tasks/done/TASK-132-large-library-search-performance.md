# TASK-132: Large-Library Hybrid Search Performance

**Phase:** Performance and polish
**Priority:** low (P3)
**Status:** done
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

- [x] 10K-bookmark performance profile is recorded in `docs/performance.md`.
- [x] Identified bottlenecks are either optimized or documented as known limitations with expected resolution path.
- [x] `npm run test:performance` runs clean against the 10K fixture within defined budgets.
- [x] Existing search and filter tests continue to pass.

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

## Work Notes

- July 12, 2026: Started as the next dependency-ready task. The higher-priority
  public distribution tasks remain blocked on unauthenticated release artifact
  access, while TASK-132 depends only on completed TASK-119 and TASK-130 work.
- Profiling begins from the existing deterministic performance harness before
  any query or index changes are made.
- Raised the default performance fixture from 2K to 10K bookmarks and added
  domain, date-range, combined-filter, aggregate, deep-offset, and full hybrid
  ranking measurements with explicit budgets.
- Added `EXPLAIN QUERY PLAN` output and regression assertions for FTS5 and tag
  index use. The measured default ordering still uses a temporary B-tree, but
  costs only 12.0 ms at 10K and 68.2 ms at 50K, so no write-costly composite
  index was added.
- Made synthetic fixture setup scale by suspending row-level FTS synchronization
  during seed generation and bulk-building equivalent FTS documents afterward.
- Found that sqlite-vec `v0.1.7-alpha.2` caps KNN requests at 4,096 neighbors.
  Exhaustive semantic/hybrid requests now fall back to durable BLOB scoring
  without disabling the healthy sqlite-vec mirror used by bounded queries.
- Recorded 1K, 10K, and 50K measurements in `docs/performance.md`. At 50K,
  aggregate counts measured 177.7 ms and exhaustive hybrid ranking measured
  621.7 ms on the reference host, so materialized counts remain unnecessary.
- Offset pagination is deterministic for an unchanged dataset because every
  ordering includes stable tie-breakers. Concurrent inserts can still shift
  later offsets; this is documented as a local single-user limitation, with
  cursor pagination reserved for a future workload that demonstrates the need.
- Added the TASK-132 visual report and updated the July, year, and top-level
  task-report indexes.
- Review hardening clamped filtered sqlite-vec over-fetching to the vec0 limit,
  strengthened response-content assertions for domain/date/read filters and
  aggregates, rejected unexpected hybrid benchmark network calls, and added a
  dedicated GitHub Actions performance regression job.
- Verification passed:
  - `npm run test:performance`
  - `LITTLEIMP_DISABLE_SQLITE_VEC=1 npm run test:performance`
  - `LITTLEIMP_PERFORMANCE_SIZE=1000 npm run test:performance`
  - `LITTLEIMP_PERFORMANCE_SIZE=50000 npm run test:performance`
  - `npm run check`
  - `npm run type-check:daemon`
  - `cd daemon && bun test src/test/embedding-repository.test.ts`
  - `npm run test:daemon` (485 tests)
  - `npm run lint` (8 existing Fast Refresh warnings, 0 errors)
  - `npx vitest run scripts/task-report-lightbox.test.ts`
  - GitHub Actions workflow YAML parse
  - `git diff --check`
