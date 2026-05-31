# TASK-105: One Click Capture Endpoint (Deferred)

**Phase:** Grimoire parity
**Priority:** high
**Status:** deferred
**Area:** daemon / integrations / bookmarks
**Source:** PAR-024
**Labels:** grimoire-parity, integrations, api, bookmarks

## Description

Record the deferred one-click capture endpoint for bookmarklet or browser
extension saves.

## Scope

1. Keep bookmarklet/browser-extension capture out of the current parity batch.
2. Reconsider after local integration token auth, CORS/origin policy, and API
   docs are stable.
3. When reopened, define capture payload, validation, idempotency, duplicate
   behavior, optional metadata, and ingestion behavior.

## Acceptance Criteria

- [x] Deferred for this parity batch.
- [x] Current local integration scope excludes bookmarklet/browser-extension
      capture.
- [ ] Future capture work starts from the security decisions in TASK-087,
      TASK-102, and TASK-106.

## Dependencies

- Deferred until local integration security behavior is implemented and a
  browser-capture product decision is reopened.
