# TASK-127: In-App Update Notification

**Phase:** First-user experience
**Priority:** high (P1)
**Status:** todo
**Area:** frontend / UX

## Description

Build on the existing update-check infrastructure (Settings manual check, `GET /updates/check`, `littleimp update check`) to add a non-intrusive in-app notification banner when a newer version is available. This closes the biggest expectation gap: users currently have to know to check for updates.

## Scope

1. **Add a background update check in the frontend:**
   - On app load, call `GET /updates/check` once
   - Debounce: do not check more than once per 6 hours (store last-check timestamp in `localStorage`)
   - Never auto-download or auto-install
   - Respect `LITTLEIMP_UPDATE_SOURCE` if the daemon already forwards it

2. **Add a subtle notification banner in the app shell (`App.tsx` or layout component):**
   - Shows when a newer version is available: "Little Imp X.Y.Z is available — [View Update]"
   - "View Update" link navigates to the Settings → Updates section
   - Dismissible (set a `localStorage` dismissal that respects the version)
   - Styled as an info banner (not a blocking modal)
   - Do not show if the daemon is unreachable or returns an error from the update check

3. **No changes to the daemon update service** — the existing `GET /updates/check` endpoint already returns the latest available version and whether an update exists.

4. **Tests:**
   - Frontend tests: mock the update check endpoint and verify banner visibility, dismissal, and debounce behavior
   - E2E test: confirm the banner appears when the mock response reports a newer version

## Acceptance Criteria

- [ ] Update check runs on app load (debounced to 6-hour intervals).
- [ ] Banner appears only when a newer version is available and is not dismissed for that version.
- [ ] Banner is dismissible and stays dismissed across page navigations.
- [ ] No banner is shown when the daemon is unreachable or returns an error.
- [ ] No banner is shown when the current version is up to date.
- [ ] Clicking the banner navigates to Settings → Updates.
- [ ] All tests pass.

## Dependencies

- Existing `GET /updates/check` daemon endpoint — complete.
- Existing Settings Updates UI — complete.

## Notes

- This is intentionally conservative: no auto-download, no auto-install, no polling when the app is not open. Just let the user know an update exists.
- The daemon update check already rejects private/loopback update source hosts for safety — the frontend doesn't need additional source validation.
