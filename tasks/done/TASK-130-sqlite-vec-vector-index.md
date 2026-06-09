# TASK-130: sqlite-vec Vector Index Integration

**Phase:** Performance and polish
**Priority:** medium (P2)
**Status:** done
**Area:** daemon / search / performance

## Description

Replace the current float32 BLOB + in-process linear scan with sqlite-vec for ANN (Approximate Nearest Neighbor) vector search. This removes the scalability ceiling for semantic search and the organization agent's duplicate detection (currently capped at 2,000 embeddings).

## Scope

1. **Add sqlite-vec as a dependency:**
   - Add the sqlite-vec Bun package or native extension
   - Ensure it loads correctly alongside the existing SQLite WAL mode and FTS5

2. **Create and migrate the vector virtual table:**
   - Define a `vec0` virtual table for embeddings with the correct dimensionality (current model's dimensions)
   - Write a migration that creates the vec0 table and populates it from existing BLOB embeddings
   - Keep the existing `embeddings` BLOB column as a fallback — dual-write during transition

3. **Update the semantic/hybrid search path:**
   - Replace the in-process BLOB scan + cosine similarity loop with a `vec0` KNN query
   - Keep the hybrid scoring formula intact (keyword * 0.6 + vector * 0.3 + recency * 0.1)
   - Ensure the vec0 query respects existing filters (tag, domain, category, date) — may need post-filter or pre-filter depending on sqlite-vec capabilities

4. **Update the organization agent:**
   - Replace the duplicate detection cosine-similarity scan with a vec0 KNN query
   - Remove the current 2,000 embedding hard cap for duplicate detection
   - Keep the cold-start guard (skip if <20 bookmarks)

5. **Benchmarks and performance tests:**
   - Add performance benchmarks comparing old (BLOB scan) vs new (vec0) semantic search for 100, 1K, 5K, and 10K bookmark libraries
   - Update `npm run test:performance` with a vec0 benchmark scenario
   - Document the expected query time improvement in `docs/performance.md`

## Acceptance Criteria

- [x] sqlite-vec loads and operates alongside existing SQLite extensions when
      an extension-capable SQLite library is available.
- [x] Derived startup/test bootstrap creates per-dimension vec0 tables and
      populates them from existing BLOB embeddings without data loss.
- [x] Semantic and hybrid search use vec0 KNN queries when available and retain
      the BLOB scan fallback.
- [x] Organization agent duplicate detection uses vec0 when available and no
      longer applies the 2,000 embedding cap on that path.
- [x] Dual-write keeps the durable BLOB column and derived vec0 tables in sync
      during transition.
- [x] Performance benchmarks show measurable improvement for libraries >1K
      bookmarks.
- [x] Existing daemon search tests continue to pass.

## Dependencies

- sqlite-vec must be compatible with the current Bun version used by the project.
- Existing embedding storage in `embeddings` table — complete.

## Notes

- This is the most impactful post-MVP performance investment. The current BLOB + in-process scan works for small libraries but degrades linearly with bookmark count.
- Consider a grace period where both vec0 and BLOB storage are maintained, then drop the BLOB column in a future cleanup migration.
- sqlite-vec supports `vec0` virtual tables with `EF_COSINE` for cosine distance. The existing embeddings are already normalized float32 — verify distance function choice.

## Work Notes

- June 8, 2026: Started as the next implementable task after public release
  validation tasks remained blocked by unauthenticated artifact `404`s.
- Confirmed `sqlite-vec` is already present in `daemon/package.json`.
- Confirmed Bun 1.3.6 on macOS arm64 cannot load extensions with its bundled
  SQLite, but works when `Database.setCustomSQLite()` points at
  `/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib`.
- Added an optional sqlite-vec loader that tries `LITTLEIMP_SQLITE_LIBRARY` and
  common Homebrew SQLite paths before falling back to the existing BLOB scan.
- Added per-dimension `vec0` tables named `embedding_vec_<dimensions>` because
  Little Imp can store embeddings from multiple models with different vector
  lengths.
- Kept `embeddings.vector` as the durable source of truth and dual-writes to
  sqlite-vec when the extension is available. Startup/test DB creation rebuilds
  the derived vector tables from existing BLOB rows.
- Treats sqlite-vec as optional after load as well: if the derived mirror cannot
  be written or queried, the daemon disables it for that database handle and
  continues with the durable BLOB scan fallback.
- Updated semantic search, hybrid search, related bookmarks, and organization
  duplicate detection to use sqlite-vec nearest-neighbor results when available,
  with the previous BLOB scoring path retained as fallback.
- Added daemon coverage for vector-table dual writes, nearest-neighbor scoring,
  active-only vector results, durable fallback after mirror write failure,
  semantic search using the sqlite-vec mirror, and duplicate detection beyond
  the old 2,000-embedding cap.
- Added a deterministic 768-dimensional nearest-neighbor benchmark matrix to
  `npm run test:performance` for 100/1K/5K/10K embeddings. On June 9, 2026
  with Homebrew SQLite and sqlite-vec `v0.1.7-alpha.2`, sqlite-vec measured
  2.1x faster at 1K, 2.1x faster at 5K, and 2.0x faster at 10K embeddings.
- Extension-unavailable hosts continue to report the BLOB baseline and skip the
  sqlite-vec improvement assertion because sqlite-vec is an optional runtime
  accelerator, not a startup requirement.
