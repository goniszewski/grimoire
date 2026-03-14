# TASK-036: First-Run Experience & Degraded Mode UI

**Status:** todo
**Priority:** medium
**Phase:** M5
**Area:** frontend

## Description

Polish the experience for two key first-launch scenarios: an empty library and a library with no AI provider configured. Both states need clear, actionable UI — not just blank screens.

## Work

### Empty library state

- Detect when `GET /bookmarks` returns an empty list AND no bookmarks have ever been saved (distinguish from "filtered to zero results")
- Replace the empty bookmark list with a centered empty-state component:
  - Friendly message: "Your library is empty"
  - Two CTAs: "Add your first bookmark" (opens `AddBookmarkDialog`) and "Import from browser" (opens import flow)
- Show this on the main feed only — archive and trash pages can keep their simpler empty messages

### Degraded mode banner

- When `GET /settings` shows `ai_provider: null` or `ai_provider: "none"`:
  - Show a dismissible info banner (not an error) below the top bar
  - Copy: "AI enrichment is disabled. Keyword search works — configure an AI provider in Settings to enable summaries, tags, and semantic search."
  - "Configure" link navigates to `/settings`
  - Dismissed state persisted in `localStorage` (key: `degraded_banner_dismissed`)
  - Banner re-appears if settings are reset to no provider

### Cold-start guard visibility

- When library has < 20 bookmarks and user opens the Review Queue page:
  - Show an info message: "The organization agent needs at least 20 bookmarks before it can make suggestions. Keep saving!"
  - Hide the suggestions list entirely (don't show an empty table)

### Daemon offline banner (verify)

- Confirm `DaemonOfflineBanner` renders correctly when daemon is unreachable on first launch
- No code change likely needed — just verify and add a Playwright test

## Acceptance Criteria

- [ ] Empty library state shows onboarding UI with both CTAs
- [ ] Degraded mode banner appears when no AI provider is configured, is dismissible, and links to settings
- [ ] Dismissed banner does not reappear on page reload (persisted in localStorage)
- [ ] Review Queue page shows cold-start message when < 20 bookmarks
- [ ] Playwright test covers: launch with empty library → empty state visible → add bookmark → empty state gone
