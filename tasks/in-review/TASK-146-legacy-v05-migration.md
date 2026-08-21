# TASK-146: Legacy Grimoire v0.5 → 1.x Migration Tool

**Phase:** post-1.0 migration
**Priority:** high
**Status:** in-review
**Area:** migration / tooling
**Source:** GH #208, PAR-041 / TASK-112 handoff
**Labels:** migration, cli, tooling

## Description

Ship a first-class migration path from legacy Grimoire **v0.5 SQLite**
(`data/db.sqlite` + `user-uploads/`) into Grimoire 1.x.

## Scope

1. Read Grimoire v0.5 SQLite schema (`user`, `bookmark`, `category`, `tag`,
   `bookmarks_to_tags`, `file`) from a v0.5 data directory or explicit db path.
2. Expose loopback daemon routes for inspect / apply, plus `littleimp migrate`
   CLI commands.
3. Support single-owner selection for multi-user databases, with optional
   password verification against `user.password_hash`.
4. Import bookmarks, categories, tags, and approved parity fields (notes,
   pinned from flagged, archived, read, open metrics, published date). Import
   local media from `user-uploads/` when present; skip importance and multi-user
   account recreation.
5. Do **not** support PocketBase-era backups (≤0.3.x).
6. Do **not** add a Grimoire 1.x app login/password account system — password is
   only for verifying ownership of a selected v0.5 user before import.

## Acceptance Criteria

- [x] `littleimp migrate inspect --data-dir <v0.5-data>` lists users and counts
- [x] `littleimp migrate apply --data-dir <v0.5-data> --owner <user> --yes` imports
      that owner's library into the running daemon
- [x] Optional `--password` / `--password-file` verifies the selected owner
- [x] Parser + apply tests cover v0.5 SQLite fixture shape and parity field mapping
- [x] API contract / docs updated for v0.5-only scope
- [x] Media path traversal and oversized files are rejected safely
- [x] Non-v0.5 databases (including PocketBase-shaped DBs) are rejected

## Work Notes

- Auth decision: owner password verification only; no multi-user login for 1.x.
- Retargeted from PocketBase ZIP to v0.5 SQLite after confirming v0.5 uses Drizzle/SQLite.
- Also accepts compressed v0.5 data archives: `.zip`, `.tar`, `.tar.gz`/`.tgz`, `.tar.bz2`, `.tar.xz`.
- Merge-all owners mode deferred; multi-user databases require `--owner`.
- Validation hardening (dirty user-data):
  - Re-run skip + `--merge` note-append / trash restore
  - In-library duplicate URLs, deep categories (>3), category cycles
  - Missing media / orphan tags / missing categories (warn + soft-skip)
  - Oversized media, disabled owners, bcrypt hashes, unicode names
  - `dbPath`+`uploadsDir`, optional absent `file` table, empty library / empty users
  - Credential / non-http URL classification; private/LAN http(s) imported with ingest skipped
  - Fixed merge path so `applyParityFields` no longer overwrites notes merged by `mergeImportDuplicate`
  - WAL-mode source DBs: open without SQLITE_OPEN_READONLY + `PRAGMA query_only=ON` (readonly failed with unable to open -shm)
  - S3/`storage_type!=local` media skipped with explicit warning
  - `.ico` import, SVG skip, tar.bz2 archives, mid-size (120) library
  - Drizzle timestamp-style `flagged`/`disabled`/`read`/`archived` values
  - Real empty `data/` dir (wiped DB + leftover uploads) fails safely with "no users"
  - Rebuilt library from real leftover `user-uploads/` (44 bookmarks, 76 files incl. nested
    path-like filenames): inspect + dry-run + apply + re-run idempotent; non-image types warn
  - Concurrent `POST /migrate/legacy/apply` returns 409 while another apply is in progress
  - Whitespace-only / NUL-contaminated titles and notes are sanitized before import
  - Blank tags dropped; blank category names fall back to slug/id
  - Merge no longer unarchives local bookmarks; trash restore still works
  - Cross-owner media skipped; multi-owner apply warns about residual libraries
  - Mid-bookmark failure rolls back DB + cleans orphan media-cache files
  - Missing `user-uploads/` warns and still imports bookmarks
  - Extensionless real ICO uploads sniffed via magic bytes (HubSpot-style paths)
  - Hardlinked media rejected; ambiguous owner / empty password hash fail safely
  - Dry-run after apply does not re-count already-imported media
  - Category color/icon/description/archive/public round-trip; large notes/HTML
  - tar.xz archive apply; prefers `data/db.sqlite` when multiple DBs in a tree
  - In-library duplicate URLs merge notes/tags/media (no silent sibling drop)
  - Preserve legacy created/updated timestamps (disable updated_at trigger during apply)
  - Merge prefers local description/content; CLI exits 1 on bookmarksFailed
  - Warn on unresolved/cross-owner category parents; allow in-tree hardlinks
  - Post-apply ingest preserves imported title/description/content (`preserveExistingContent`)
  - `--merge` keeps local `category_id`; prefers newer `read_at` (same as `last_opened_at`)
  - Declared `file."mime-type"` used as image fallback after extension/sniff
  - Assert `trg_bookmarks_updated_at` is restored after apply
  - Reused same-name categories fill blank color/icon/description/archive/public
  - Unix `content_published_date` → ISO; URL host casing collapsed for duplicates
  - Remote-only favicon/main_image URLs warn; archive symlink escape rejected post-extract
  - Post-ingest preserve imported media; URL-stub titles upgradable; slug UNIQUE collision safe
  - Duplicate URL merge prefers real titles; `--merge` fills stub titles; trigger recreated on daemon boot
  - Exact real `db.sqlite` schema clone (Docker/v0.5 empty DB) + argon2id user + uploads: inspect/apply/password OK
  - Live Docker-populated probe also succeeded (4 bookmarks, nested cats, media, content HTML; private/LAN now imported)
  - Protected migrated `legacy://` media from cache eviction; unique media source keys for same-filename dups
  - Sync media import inside SAVEPOINT (no await on shared DB); apply API returns 207 when bookmarksFailed > 0
  - FTS indexes preserved migrated markdown under preserveExistingContent
  - Reprocess/retry preserves `legacy://` media + content; trash stubs auto-restore without `--merge`
  - `--merge` fills null local category; bare-origin URLs canonicalize without trailing slash
  - Content-only Retry preserves stored HTML/markdown; category reuse never flips archive/public
  - Media import trusts magic-byte sniff over extension/declared mime (blocks renamed hardlink payloads)
  - HTML-only imports get searchable markdown + FTS; failed media no longer blocks ingest enqueue
  - Kitchen-sink stress fixture (deep cats, LAN, dups, bulk, media) migrates with 0 failures
  - Refuse all archive symlinks; warn http/https near-duplicate URLs; exact-schema covers disabled user + large notes
  - Live v0.5 UI form library (signup + addNewBookmark/Category) migrated with password; fixed dup-URL title preference
  - Validation hardening (continued): content_type warn; trash restore keeps archive; dry-run taxonomy matches apply;
    media I/O soft-skip; FTS keeps description; host-case findByUrl; merge created/updated min/max; merge leaves
    pin/archive alone; favicon fill-blank + promote curated `/media/` over remote icon_url (remote kept if media skips);
    IDN hosts; nested zip `data/`; dense 89-bookmark fixture + leftover 44-upload reconstruct OK
  - Intact original populated user `db.sqlite` still not located (wiped DB freelist empty; no TM destinations)
  - CLI surfaces RFC 7807 `detail` from migrate 401/422/409 problem+json (not opaque status NNN)
  - Production non-destructive hardening:
    - Source DB opened via temp snapshot (+ WAL/SHM/journal copy); user path hash-stable
    - Archive symlink/hardlink refused from listing before extract; empty destDir required
    - In-process apply mutex → HTTP 409 on overlap
    - updated_at trigger dropped inside the apply transaction and restored before commit;
      daemon boot repairs older crash leftovers
    - Apply uses BEGIN IMMEDIATE…COMMIT (soft-fail per bookmark via SAVEPOINT); crash before
      commit rolls back whole apply + unlinks written media; orphan media cleaned on apply/boot
    - FAQ + roadmap + parity docs document non-destructive source + additive target workflow
