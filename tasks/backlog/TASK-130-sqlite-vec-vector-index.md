# TASK-130: sqlite-vec Vector Index Integration

**Phase:** Performance and polish
**Priority:** medium (P2)
**Status:** backlog
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

- [ ] sqlite-vec loads and operates alongside existing SQLite extensions.
- [ ] Migration creates the vec0 table and populates it without data loss.
- [ ] Semantic and hybrid search use vec0 KNN queries and return equivalent or better results than the BLOB scan.
- [ ] Organization agent duplicate detection uses vec0 and no longer caps at 2,000 embeddings.
- [ ] Dual-write keeps the BLOB column consistent during transition.
- [ ] Performance benchmarks show measurable improvement for libraries >1K bookmarks.
- [ ] All existing daemon search tests continue to pass.

## Dependencies

- sqlite-vec must be compatible with the current Bun version used by the project.
- Existing embedding storage in `embeddings` table — complete.

## Notes

- This is the most impactful post-MVP performance investment. The current BLOB + in-process scan works for small libraries but degrades linearly with bookmark count.
- Consider a grace period where both vec0 and BLOB storage are maintained, then drop the BLOB column in a future cleanup migration.
- sqlite-vec supports `vec0` virtual tables with `EF_COSINE` for cosine distance. The existing embeddings are already normalized float32 — verify distance function choice.
