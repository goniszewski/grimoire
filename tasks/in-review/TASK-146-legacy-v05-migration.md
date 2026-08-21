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
