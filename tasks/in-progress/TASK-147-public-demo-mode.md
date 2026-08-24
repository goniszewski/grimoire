# TASK-147: Public Demo Mode

**Phase:** Product reset and public beta
**Priority:** high (P1)
**Status:** in-progress
**Area:** frontend / demo / distribution

## Description

Build the first implementation slice of a public, static Grimoire demo. The
demo uses the real React frontend and API client against an in-browser,
session-scoped fixture router; it must never expose or weaken the local daemon.

## Scope

1. Add a `VITE_DEMO_MODE` build profile with a same-origin virtual API base.
2. Inject the API transport at the existing fetch/EventSource egress points
   without weakening the loopback-only daemon URL guard.
3. Promote the Playwright mock daemon core into a browser-safe shared router,
   preserving a thin Playwright adapter for existing end-to-end tests.
4. Provide curated fixture data and route coverage for browsing, filtering,
   keyword search, detail content, related bookmarks, timeline, suggestions,
   settings, and JSON/CSV export.
5. Add demo framing and safe action gating: persistent banner, reset control,
   install guidance for local-only actions, disabled app lock, and no fake
   network/AI behavior.
6. Add focused tests and the demo build/preview/e2e entry points. Keep
   deploy-host decisions, analytics, and public launch ownership as documented
   follow-ups until explicitly decided.

## Acceptance Criteria

- [x] `npm run build:demo` produces a static SPA without `127.0.0.1:3210` or
      `localhost:3210` in the output.
- [x] The demo loads fixture bookmarks without a Bun daemon or SQLite database.
- [x] Library, filters, keyword search, detail content, related bookmarks,
      timeline, suggestions, and JSON/CSV export use real API client paths.
- [x] Session mutations remain in-memory and Reset demo clears state and known
      demo-local storage keys.
- [x] Add/import/backup/diagnostics/tokens/bookmarklet/update paths are gated or
      hidden with install guidance; app lock cannot persist a lockout.
- [x] Demo-only framing hides the normal AI setup prompt, avoids sidebar cookie
      writes, and routes category/tag management actions to install guidance.
- [ ] Existing loopback URL validation and existing Playwright mock-daemon
      coverage remain intact.
- [x] Focused router/e2e tests, frontend type-check, build, and whitespace
      validation pass; visual evidence is recorded in a task report.

The first implementation slice is complete locally. The unchecked adapter
criterion remains open because the existing broad Playwright mock still needs
to be reduced to a thin adapter over the shared browser-safe router; it was
left unchanged so the existing daemon-flow coverage is preserved while this
slice lands.

## Dependencies

- None for the client-only implementation slice.
- Final hostname, analytics policy, index/noindex choice, CTA destination,
  fixture ownership, and kill-switch ownership remain launch decisions.

## Out of Scope

- Public-network daemon exposure, hosted data, accounts, auth, or server-side
  persistence.
- Live URL ingestion, extraction, LLM/embedding calls, import SSE, backup/
  restore, MCP, diagnostics export, update checks, or subpath hosting.
- Changes to daemon bind host, CORS policy, or outbound security guards.

## References

- [Task board and launch follow-ups](../README.md#current-status)
- [Task report instructions](../../docs/task-reports/INSTRUCTION.md)
- [API contract](../../docs/api-contract.json)
