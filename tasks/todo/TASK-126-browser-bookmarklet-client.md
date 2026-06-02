# TASK-126: Browser Bookmarklet Client

**Phase:** First-user experience
**Priority:** high (P1)
**Status:** todo
**Area:** frontend / integration

## Description

Ship a minimal bookmarklet that uses the existing protected `/capture` endpoint (TASK-105). This is the single highest-impact UX improvement for a bookmark manager: users can save a URL without opening the Little Imp app. The daemon endpoint already exists; the gap is the client.

## Scope

1. **Create the bookmarklet script (`src/bookmarklet.ts` or similar):**
   - Reads the current page URL (`document.location.href`)
   - Reads the page title (`document.title`)
   - Optionally reads selected text (`window.getSelection()`) as notes
   - POSTs to `http://127.0.0.1:3210/capture` with a configured bearer token
   - Displays a success/error toast overlay on the page
   - Must be self-contained (no external dependencies) so it can be minified into a `javascript:` URL

2. **Add a Settings UI section ("Capture" or "Browser Integration") that:**
   - Shows existing integration tokens (redacted) or generates a new one
   - Displays the bookmarklet install link: a `javascript:` URL the user drags to their bookmarks bar
   - Shows setup instructions for Chrome, Firefox, Safari, and Edge

3. **Create a daemon endpoint or extend Settings to serve the bookmarklet code** so the Settings page can offer a one-click "drag to bookmarks bar" experience. The bookmarklet JS should be served with `Content-Type: text/plain` or as a data URL.

4. **Documentation:**
   - Add a "Browser bookmarklet" section to README.md
   - Add setup instructions to `docs/overview.md`
   - Reference the feature in Settings help tooltip

5. **Tests:**
   - Unit tests for the bookmarklet URL construction and payload shape
   - Frontend tests for the Settings capture UI section
   - E2E test that creates a token, drags/bookmarklet, and confirms the capture endpoint returns success (using Playwright's `page.evaluate` to simulate)

## Out of Scope

- Packaged browser extension (Chrome/Firefox/Safari extension with permissions, store listings, auto-update). This is a pure bookmarklet — zero install friction.
- The `/capture` endpoint itself already exists and should not need changes.

## Acceptance Criteria

- [ ] Bookmarklet JS can be generated from Settings with a one-click setup flow.
- [ ] Dragging the bookmarklet to the browser bar works in Chrome, Firefox, Safari, and Edge.
- [ ] Clicking the bookmarklet on any public HTTP(S) page sends the URL, title, and optional selection to the daemon.
- [ ] Success/error feedback is shown as an in-page overlay within 2 seconds.
- [ ] Fails gracefully when the daemon is unreachable (no JS errors).
- [ ] Settings page allows token management for capture.
- [ ] All tests pass.

## Dependencies

- TASK-105 (one-click capture endpoint) — complete.
- TASK-102 (integration token authentication) — complete.

## Notes

- The bookmarklet must be self-contained minified JS (no bundler output needed at runtime — just a `javascript:` URI).
- Token is embedded in the bookmarklet JS at generation time. Document the security model: tokens have read/write capture scope; the bookmarklet is stored in the browser bookmarks bar; treat it like a password.
- Consider using a `<link rel="bookmarklet">` or `data:text/html` approach for cross-browser compatibility.
