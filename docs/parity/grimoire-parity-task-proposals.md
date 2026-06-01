# Grimoire Parity Task Proposals

Date: 2026-05-30

This document turns the remaining Little Imp vs Grimoire parity gaps into proposed implementation tasks. Use it as an approval worksheet before creating concrete task files under `tasks/`.

Conversion status: rows that had `x` or `X` in **My Comment** were initially treated as approved and converted to backlog tasks. Follow-up refinement on 2026-05-31 locked the current batch as local-first, single-user, and local-integrations-only; rejected bookmark importance; deferred browser-extension/bookmarklet capture; deferred Grimoire backup import tooling; and approved import duplicate handling as `TASK-120`.

Suggested values:

- Approval: `Approved`, `Deferred`, `Rejected`, or leave blank while under review.
- Development Status: `Not started`, `In progress`, `Blocked`, `In review`, or `Done`.
- My Comment: free-form product, scope, owner, or sequencing notes.

## Epic 1: Scope And Compatibility Decisions

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-001 | Approve the target parity mode: local-first only, integration-compatible local app, or Grimoire-style multi-user/server mode. | Critical | Approved | Done | Decision: current parity batch is local-first, single-user, loopback-first, and local-integrations-only. Admin/regular-user ownership and per-user backup scope are deferred until multi-user/server mode is reopened. |
| PAR-002 | Define which Grimoire differences are intentional non-goals and document them in the parity report. | Critical | Approved | Done | Completed in `TASK-085`. |
| PAR-003 | Convert approved parity rows into task-file acceptance criteria and labels. | High | Approved | Done | Completed in `TASK-086`. |
| PAR-004 | Define security boundaries for any feature that exposes the daemon beyond trusted loopback usage. | Critical | Approved | Done | Completed in `TASK-087`. |
| PAR-005 | Add a recurring parity checklist to release planning so closed gaps stay closed. | Medium | Approved | Done | Completed in `TASK-088`; recurring release checklist entries now live in `docs/release-checklist.md`. |

## Epic 2: Bookmark Model And Detail Parity

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-006 | Fix the bookmark detail URL and summary edit mismatch by either implementing supported mutations or removing the editable affordance. | Critical | Deferred | Done | Mutation support remains deferred; `TASK-094` closed the immediate mismatch by keeping canonical URL and extracted summary immutable and removing their unsupported detail edit affordances. |
| PAR-007 | Decide whether Little Imp pinning maps to Grimoire starred/favorite state and whether a separate flag field is required. | High | Approved | Done | Decision: Grimoire starred/favorite maps to existing Little Imp pinning. A separate read-later flag is desirable. Implementation: `TASK-089`. |
| PAR-008 | Implement read-later persistence, API contract, list badges, bulk actions, filters, and tests. Map Grimoire starred/favorite state to existing pinned state. | High | Approved | Done | Done: `TASK-089`. |
| PAR-009 | Add bookmark importance rating with schema migration, API update support, editor control, sort, filter, import/export coverage, and tests. | Medium | Rejected | Not started | Rejected for this parity batch. It does not directly improve vector search and adds schema/API/UI/filter/export complexity without clear current workflow value. Record: `TASK-090`. |
| PAR-010 | Track opened count and last-opened timestamp when users open bookmark URLs from cards, detail, search, and related-bookmark surfaces. | Medium | Approved | Done | Done: `TASK-091`. |
| PAR-011 | Add richer bookmark detail sections for extracted markdown/content, author, published date, word count, language, and pipeline metadata. | High | Approved | Done | Done: `TASK-092`. |
| PAR-012 | Define media handling for favicon, screenshot, and extracted images, then add a detail media preview if it fits the local storage model. | Medium | Approved | Not started | Backlog: `TASK-093`. |
| PAR-013 | Add regression tests for all bookmark field mutations and visible detail controls. | High | Approved | Done | Done: `TASK-094`. |

## Epic 3: Category And Tag Parity

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-014 | Render category navigation from the full `/categories` tree so empty categories and hierarchy are visible, not only categories from loaded bookmarks. | High | Approved | Done | Done: `TASK-095`. |
| PAR-015 | Add a dedicated category detail page with category metadata, child categories, and paginated bookmark list. | Medium | Approved | Done | Done: `TASK-096`. |
| PAR-016 | Add optional category fields from Grimoire parity: color, icon, description, slug, archived, and public visibility after product approval. | Medium | Approved | In review | In review: `TASK-097`. |
| PAR-017 | Add a dedicated tag management surface for listing, creating, deleting, and browsing tags outside bookmark detail. | High | Approved | In review | In review: `TASK-098`. |
| PAR-018 | Add tag detail pages with tag metadata and paginated bookmark lists. | Medium | Approved | Done | Done: `TASK-099`. |
| PAR-019 | Add tag rename API and UI if Grimoire-compatible tag management is approved. | Medium | Approved | Done | Done: `TASK-100`. |
| PAR-020 | Add category/tag regression tests for empty rows, counts, drag reparenting, delete behavior, and filter refresh. | High | Approved | Done | Done: `TASK-101`. |

## Epic 4: Integration API And Browser Capture

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-021 | Add optional integration-token authentication for non-browser clients while preserving secure loopback defaults. | Critical | Approved | Done | Done: `TASK-102`. |
| PAR-022 | Generate human-readable API documentation from `docs/api-contract.json`, including request and response examples. | High | Approved | Done | Done: `TASK-103`. |
| PAR-023 | Add OpenAPI-compatible output for local integration clients. | High | Approved | Done | Done: `TASK-104`. |
| PAR-024 | Add a one-click capture endpoint for bookmarklet or extension saves with title, tags, category, notes, and source metadata. | High | Deferred | Not started | Deferred. Current scope is local API integrations only, not bookmarklet/browser-extension capture. Record: `TASK-105`. |
| PAR-025 | Add Grimoire-compatible endpoint aliases or adapters only where they reduce migration or extension work. | Medium | Rejected | Not started | Not needed for the current parity batch. |
| PAR-026 | Add CORS/origin policy controls and documentation for integration clients. | High | Approved | Done | Done: `TASK-106`. |
| PAR-027 | Add browser-extension compatibility smoke tests for save, update, categorize, tag, and auth failure flows. | Medium | Rejected | Not started | Not needed for the current parity batch. |

## Epic 5: Accounts, Profile, And Admin

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-028 | Turn `docs/multi-user-post-mvp-research.md` into an approved or rejected implementation decision. | Critical | Deferred | Not started | Skip multi-user support for now; record as an intentional non-goal under `TASK-085`. |
| PAR-029 | Add user, session, membership, and role schema only if multi-user/server mode is approved. | Conditional | Deferred | Not started | Deferred with PAR-028. |
| PAR-030 | Add signup, login, logout, current-user, and session persistence flows if account parity is approved. | Conditional | Deferred | Not started | Deferred with PAR-028. |
| PAR-031 | Scope bookmarks, categories, tags, search, jobs, backups, MCP, settings, and diagnostics by environment/user if multi-user mode is approved. | Conditional | Deferred | Not started | Deferred with PAR-028. |
| PAR-032 | Add profile page with account details, stats, and password change if account parity is approved. | Conditional | Deferred | Not started | Deferred with PAR-028. |
| PAR-033 | Add admin user management with first-admin bootstrap, roles, disable/delete actions, and audit expectations if approved. | Conditional | Deferred | Not started | Deferred with PAR-028. |
| PAR-034 | Add auth/session integration tests and threat-model documentation before any public-network deployment mode. | Conditional | Deferred | Not started | Deferred with PAR-028. |

## Epic 6: Import, Export, And Migration

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-035 | Preserve Netscape folder hierarchy as Little Imp categories during import, using the parser's existing `folders` data. | High | Approved | Done | Completed in `TASK-107`. |
| PAR-036 | Add pre-import review with detected folders, tags, duplicates, invalid URLs, skipped private URLs, and estimated changes. | High | Approved | Not started | Backlog: `TASK-108`. |
| PAR-037 | Add category and tag remapping before committing imported bookmarks. | Medium | Approved | Not started | Backlog: `TASK-109`. |
| PAR-038 | Add duplicate handling choices: skip active duplicates by default with merge option, restore archived duplicates with merge, restore trashed duplicates with merge or skip, and report invalid/private URLs. | High | Approved | Done | Completed in `TASK-120` with daemon preview/commit policy semantics, generated API docs, frontend API helpers, and repeated-source duplicate hardening. |
| PAR-039 | Add import result report with created, updated, skipped, failed, and warning rows. | Medium | Approved | Done | Completed in `TASK-110`. |
| PAR-040 | Expand JSON/CSV export to include approved parity fields such as notes, read state, archive state, pinned/starred mapping, read-later state, and opened metrics. | Medium | Approved | Done | Completed in `TASK-111`. |
| PAR-041 | Add Grimoire backup import tooling only after browser/Netscape import and JSON/CSV export parity are stable. | Low | Deferred | Not started | Deferred. Current batch focuses on robust browser/Netscape import and export parity. Future record: `TASK-112`. |
| PAR-042 | Add import/export regression tests with large files, folder nesting, duplicates, invalid URLs, and parity fields. | High | Approved | Not started | Backlog: `TASK-113`. |

## Epic 7: Search, Filters, Pagination, And Scale

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-043 | Add explicit UI pagination backed by existing daemon pagination. | High | Approved | Not started | Backlog: `TASK-114`. |
| PAR-044 | Move sort options to server-driven ordering for created date, updated date, title, domain, opened count, and last-opened date. | Medium | Approved | Not started | Backlog: `TASK-115`. |
| PAR-045 | Add filters for unread/read, pinned/starred, read-later, opened count, and last-opened date after fields are approved. | High | Approved | Not started | Backlog: `TASK-116`. |
| PAR-046 | Persist saved filter, sort, view, and page-size preferences locally. | Medium | Approved | Not started | Backlog: `TASK-117`. |
| PAR-047 | Add aggregate endpoints for category, tag, domain, read, pinned/starred, and read-later counts independent of currently loaded result pages. | Medium | Approved | Not started | Backlog: `TASK-118`. |
| PAR-048 | Add large-library performance tests for list, search, category filters, tag filters, import, and pagination. | Medium | Approved | Not started | Backlog: `TASK-119`. |

## Epic 8: Documentation, Verification, And Release Readiness

| ID | Proposed Task | Priority | Approval | Development Status | My Comment |
| --- | --- | --- | --- | --- | --- |
| PAR-049 | Add parity-driven API examples for local token auth, bookmark CRUD/update, search/list/filter/sort/pagination, import/export, categories, and tags. | High | Approved | Not started | Covered by `TASK-103`; no separate task file. Browser extension/bookmarklet examples are deferred. |
| PAR-050 | Update README, roadmap, and release docs with approved Grimoire parity goals and explicit non-goals. | High | Pending | Not started |  |
| PAR-051 | Add task reports for visible parity work and link them from `docs/task-reports/index.html`. | Medium | Pending | Not started |  |
| PAR-052 | Add visual verification coverage for category/tag management, bookmark detail, import review, and pagination once implemented. | Medium | Pending | Not started |  |
| PAR-053 | Add contract checks that fail when daemon route behavior diverges from `docs/api-contract.json`. | High | Pending | Not started |  |
| PAR-054 | Add a final Grimoire parity acceptance checklist before promoting a beta release as parity-complete. | High | Pending | Not started |  |
