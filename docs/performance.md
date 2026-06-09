# Performance Checks

Little Imp keeps the default daemon test suite focused and fast. Heavier
large-library checks run separately:

```sh
npm run test:performance
```

The script builds an in-memory SQLite app with 2,000 representative bookmarks,
12 categories, 24 tags, searchable content, pagination metadata, read state,
open metrics, and read-later/pinned flags. It then measures:

| Check | Budget |
| --- | ---: |
| First library page | 500 ms |
| Deep pagination page | 500 ms |
| Keyword search | 800 ms |
| Category filter | 500 ms |
| Tag filter | 650 ms |
| 240-row import preview | 1,000 ms |
| 240-row import commit, progress completion, and persistence | 3,000 ms |
| 768-dimensional nearest-neighbor benchmark matrix | sqlite-vec faster than BLOB at 5K and 10K embeddings when sqlite-vec is available |

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
so the deterministic script benchmarks the nearest-neighbor repository path
used by semantic search, hybrid search, related bookmarks, and duplicate
detection. Keyword, list, filters, pagination, and import paths run fully local
against the daemon API.
