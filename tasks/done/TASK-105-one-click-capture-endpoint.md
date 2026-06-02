# TASK-105: One Click Capture Endpoint

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** daemon / integrations / bookmarks
**Source:** PAR-024
**Labels:** grimoire-parity, integrations, api, bookmarks

## Description

Add a protected local one-click capture endpoint for explicit integration
clients. The endpoint accepts a URL plus optional title, tags, category, notes,
and source metadata, then creates a normal bookmark and queues the standard
ingestion pipeline.

## Scope

1. Require managed local integration bearer tokens for `/capture`.
2. Validate public HTTP/HTTPS target URLs and reject private or loopback hosts.
3. Support optional title, normalized tags, existing category IDs, root category
   name resolution/creation, notes, and capture source metadata.
4. Preserve normal bookmark duplicate behavior: active duplicates are returned
   idempotently, while archived or trashed duplicates return conflicts.
5. Enqueue the standard ingest job only for newly created bookmarks.
6. Keep packaged browser-extension/bookmarklet clients and extension smoke tests
   out of this task.

## Acceptance Criteria

- [x] `/capture` requires `Authorization: Bearer <integration-token>`.
- [x] Capture request validation covers payload shape, URL safety, tags,
      category assignment, notes, source metadata, and ambiguous category
      fields.
- [x] New captures create bookmarks, persist capture metadata when supplied, and
      enqueue normal ingest jobs.
- [x] Active duplicate captures are side-effect-free and do not merge metadata
      or queue duplicate work.
- [x] Archived or trashed duplicate URLs return conflict responses.
- [x] Generated `API.md`, `docs/api-contract.json`, and `docs/openapi.json`
      document the protected endpoint and bearer-token requirement.
- [x] Daemon and docs-generator tests cover auth, validation, duplicate, queue,
      metadata, and contract behavior.

## Dependencies

- Depends on security decisions in TASK-087 and implemented token/CORS/API docs
  behavior in TASK-102, TASK-103, TASK-104, and TASK-106.

## Work Notes

- June 2, 2026: Implemented `POST /capture` as a protected local integration
  endpoint. It reuses the bookmark repository and durable queue, adds
  append-only capture metadata storage, and leaves first-party `/bookmarks`
  tokenless behavior unchanged.
- The endpoint accepts root category names for one-click convenience, but
  active duplicate captures remain side-effect-free and do not create categories
  or merge replacement metadata.
- Packaged browser-extension/bookmarklet clients are still future work; this
  task only ships the daemon contract that such clients can use deliberately.
