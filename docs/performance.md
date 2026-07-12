# Performance Checks

Little Imp keeps the default daemon test suite focused and fast. Heavier
large-library checks run separately:

```sh
npm run test:performance
```

The script builds an in-memory SQLite app with 10,000 representative bookmarks,
12 categories, 24 tags, searchable content, pagination metadata, read state,
open metrics, and read-later/pinned flags. Synthetic fixture creation suspends
the normal row-by-row FTS triggers and rebuilds the same FTS documents in bulk,
so setup time does not dominate the query profile. It then measures:

| Check | Budget |
| --- | ---: |
| First library page | 1,000 ms |
| Deep pagination page | 1,000 ms |
| Keyword search | 1,500 ms |
| Category, tag, domain, date, and combined filters | 1,000 ms each |
| Aggregate counts | 1,000 ms |
| Hybrid search with a deterministic local embedding response | 1,500 ms |
| 240-row import preview | 1,000 ms |
| 240-row import commit, progress completion, and persistence | 3,000 ms |
| 768-dimensional nearest-neighbor benchmark matrix | sqlite-vec faster than BLOB at 5K and 10K embeddings when sqlite-vec is available |

The default 10K workload is the regression check used by
`npm run test:performance` and the dedicated `Large-library performance
regression` GitHub Actions job. Larger local profiles can be requested without
changing source:

```sh
LITTLEIMP_PERFORMANCE_SIZE=50000 npm run test:performance
```

Import commit gets a size-adjusted allowance above 10K because that optional
profile measures search scaling against an already-large FTS index; the normal
10K regression budget remains 3 seconds.

Semantic and hybrid search now use a derived sqlite-vec index when the daemon
can load the `sqlite-vec` extension. The durable `embeddings.vector` BLOB column
remains the source of truth; startup rebuilds per-dimension `embedding_vec_*`
virtual tables from those BLOB rows and embedding writes dual-write into the
matching vector table. On hosts where extension loading is unavailable, the
daemon keeps the previous BLOB scan fallback. If the derived vector mirror is
present but cannot be written or queried, the daemon disables sqlite-vec for
that database handle and continues against the durable BLOB rows.

The performance script also includes a deterministic repository-level vector
benchmark that does not require provider settings, network access, or a local
model. It seeds normalized 768-dimensional embeddings and compares the durable
BLOB scan fallback against the derived sqlite-vec mirror for 100, 1K, 5K, and
10K embeddings. When sqlite-vec is available, the 5K and 10K rows must be
faster than the BLOB scan. When extension loading is unavailable, the script
still reports the BLOB baseline and skips the sqlite-vec assertion.

Local macOS arm64 evidence from June 9, 2026 with Homebrew SQLite and
sqlite-vec `v0.1.7-alpha.2`:

| Embeddings | BLOB scan | sqlite-vec | Improvement |
| --- | ---: | ---: | ---: |
| 100 | 2.09 ms | 0.37 ms | 5.7x |
| 1,000 | 5.30 ms | 2.58 ms | 2.1x |
| 5,000 | 27.09 ms | 13.12 ms | 2.1x |
| 10,000 | 50.12 ms | 25.04 ms | 2.0x |

Full semantic and hybrid API flows still depend on query embedding generation,
so the performance script stubs only the embedding HTTP response with a
deterministic local vector. Hybrid ranking, FTS5, sqlite-vec/BLOB selection,
recency scoring, pagination, and bookmark hydration still run through the real
repositories. Keyword, list, filters, aggregates, pagination, and import paths
run fully local against the daemon API.

## Large-library scaling evidence

Measured July 12, 2026 on macOS arm64 with Bun 1.3.6, Homebrew SQLite, and
sqlite-vec `v0.1.7-alpha.2`. Times are warm, in-memory regression measurements,
not disk-latency guarantees; the enforced budgets above intentionally leave
wide headroom for CI and slower hosts.

| Check | 1K | 10K | 50K |
| --- | ---: | ---: | ---: |
| First library page | 4.0 ms | 5.7 ms | 17.5 ms |
| Deep offset page | 1.2 ms | 12.0 ms | 68.2 ms |
| Keyword search | 2.1 ms | 7.1 ms | 36.7 ms |
| Category filter | 0.6 ms | 0.9 ms | 3.4 ms |
| Tag filter | 0.6 ms | 1.8 ms | 10.4 ms |
| Domain filter | 0.4 ms | 0.7 ms | 2.0 ms |
| Date range filter | 0.6 ms | 0.7 ms | 0.7 ms |
| Combined tag/category/read filter | 0.5 ms | 1.6 ms | 11.3 ms |
| Aggregate counts | 2.1 ms | 22.6 ms | 177.7 ms |
| Hybrid search | 11.7 ms | 121.3 ms | 621.7 ms |

The 50K profile remains inside the 10K regression budgets. Aggregate counts and
exhaustive hybrid scoring grow most visibly, but both remain below one second
at 50K on the reference host. No materialized aggregate cache or new composite
bookmark index was added because the measured read cost does not justify extra
write complexity at the current personal-library scale.

## Query plans and fallback boundary

The performance command records `EXPLAIN QUERY PLAN` output for deep library
pagination, FTS keyword search, combined tag/category filtering, and date-range
filtering. It fails if keyword search stops using the FTS5 virtual index or the
combined filter stops using `idx_bookmark_tags_tag`. The current plans confirm:

- keyword search scans the FTS5 virtual index and joins bookmarks by primary key;
- tag filters use the tag-name index and `idx_bookmark_tags_tag`;
- date ranges use `idx_bookmarks_created`;
- the default pinned/date ordering uses a temporary B-tree.

The regression also exercises a 3,000-result filtered sqlite-vec query when the
extension is available. This guards the over-fetch calculation itself: bounded
filtered searches must never ask vec0 for more than its 4,096-neighbor limit.

The temporary ordering sort measured 12.0 ms at 10K and 68.2 ms at 50K, so it
is documented rather than optimized preemptively. sqlite-vec `v0.1.7-alpha.2`
also caps a single KNN request at 4,096 neighbors. Bounded nearest-neighbor
queries use sqlite-vec when enough filter-eligible rows are found inside that
window. Exhaustive semantic/hybrid ranking above the limit, and unusually sparse
filters that need a wider scan, deliberately use the durable BLOB path. Crossing
this capacity boundary no longer disables the healthy sqlite-vec mirror for
later bounded queries.

Offset pagination remains deterministic while the dataset is unchanged because
the repository adds stable created-time and ID tie-breakers. A concurrent insert
can still shift later offsets and cause a repeated or skipped row. That is an
accepted limitation for the current local single-user workload; cursor-based
pagination is the expected follow-up if real concurrent mutation makes the
shift observable in user flows.
