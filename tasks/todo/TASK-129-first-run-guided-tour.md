# TASK-129: First-Run Guided Tour and Demo Content

**Phase:** First-user experience
**Priority:** medium (P2)
**Status:** todo
**Area:** frontend / UX / onboarding

## Description

Enhance the existing first-run experience (TASK-036) with a lightweight guided tour and optional demo content that helps new users immediately understand the product's value without having to first save their own bookmarks.

## Scope

1. **Demo content fixture:**
   - Create a curated JSON fixture of ~10 demo bookmarks representing realistic developer content (technical blog posts, documentation pages, a GitHub repo, a YouTube talk, a PDF — all with fake but plausible titles, domains, tags, categories, and a summary)
   - Add a daemon endpoint or extend the existing import endpoint to accept a "load demo data" flag
   - Add a "Load demo bookmarks" button on the first-run empty state
   - When clicked, imports the demo data and redirects to the library so the user can immediately see search, categories, related bookmarks, and the review queue working

2. **Guided tour overlay:**
   - Add a 3-step overlay that appears on the very first visit (tracked via localStorage):
     - Step 1: "Save a bookmark — paste any URL in the bar above or use [the bookmarklet]". Highlight the add button.
     - Step 2: "Search everything — try searching for a topic. Keyword search works immediately; AI-powered semantic search activates when you configure a provider in Settings."
     - Step 3: "Stay organized — categories, tags, and AI suggestions help you find things later. Check your Review Queue for auto-generated suggestions."
   - Each step has "Next" / "Got it" buttons
   - Dismissible at any point
   - Does not reappear after dismissal

3. **Empty-state improvements:**
   - Update the Library empty state to show both "Save your first bookmark" and "Load demo bookmarks" as clear CTAs
   - Update Archive and Trash empty states to reference the Library
   - Ensure the offline/daemon-unreachable banner still takes precedence

## Acceptance Criteria

- [ ] Demo content option appears on a fresh-install empty library.
- [ ] Clicking "Load demo bookmarks" imports ~10 bookmarks and redirects to a populated library view.
- [ ] Downloaded bookmarks are tagged as "demo" and can be batch-deleted from Settings or individually removed.
- [ ] Guided tour runs once on first visit and does not reappear.
- [ ] Tour is dismissible at any step.
- [ ] All empty states are useful and contextual.
- [ ] Frontend tests cover tour overlay, demo import call, and empty state rendering.

## Dependencies

- TASK-036 (first-run experience) — complete.
- Existing import infrastructure — complete.

## Notes

- Demo data should be realistic enough to demonstrate search, categories, tags, and related bookmarks, but fake — never real copyrighted content.
- Consider adding a "Remove demo data" button in Settings → Data Management.
- The guided tour should degrade gracefully on narrow/mobile viewports.
