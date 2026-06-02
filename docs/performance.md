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

Semantic and hybrid search are not part of the deterministic budget script
because they require provider settings and network or local-model availability.
Add a separate provider-backed check when those modes need budget enforcement.
Keyword, list, filters, pagination, and import paths run fully local against
the daemon API.
