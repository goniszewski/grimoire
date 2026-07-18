# TASK-135: Public-Facing Documentation Polish

**Phase:** Verification and release readiness
**Priority:** high (P1)
**Status:** done
**Area:** documentation / project-site

## Description

Prepare the repository for public visibility. The codebase, README, and docs are functional but were written during development and assume reader familiarity. Polish them for a first-time visitor who finds the project on GitHub.

## Scope

1. **README.md refresh:**
   - Add a project logo or ASCII-art banner at the top
   - Write a clear one-paragraph elevator pitch (already exists but could be tightened)
   - Add a "Quick Start" section with the one-command install command (when the repo is public) or the developer setup instructions
   - Add a "Screenshots" section with key views: library, search results, bookmark detail, settings, import dialog
   - Organize the table of contents cleanly
   - Ensure badges (CI status, Bun version, license) are present and correct

2. **Add a FAQ (`docs/faq.md`):**
   - "Can I sync my bookmarks across devices?" — Not yet, backups are snapshot-based.
   - "Is my data private?" — Yes, all data is local. AI providers are optional.
   - "What happens if the daemon crashes?" — Bookmarks are stored in SQLite with WAL mode. Rerun `littleimpd` or restart the service.
   - "Can I use it without AI providers?" — Yes, all core features work. The UI shows degraded mode.
   - "How do I upgrade?" — Settings → Updates, or `littleimp update install`. See `docs/update-system.md`.
   - "Does it work on Windows?" — Not natively. Docker on Windows WSL2 is the supported path.
   - "Can I run it on a server?" — Yes through Docker, but keep it behind an authenticated tunnel. See `docs/security-boundaries.md`.

3. **SECURITY.md review:**
   - Confirm it exists with reporting contact and PGP key if applicable
   - Add the security boundary posture summary from `docs/security-boundaries.md`

4. **CONTRIBUTING.md review:**
   - Update any stale setup instructions
   - Add a "Running tests" section referencing `npm run check`, `npm run test:e2e`, `npm run test:daemon`

5. **Local link audit:**
   - Run a full local markdown link audit across `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/*.md`, and `tasks/README.md`
   - Fix any broken anchors or file references

6. **GitHub repo metadata:**
   - Ensure the repo description, homepage URL, and topics/tags are set appropriately (this may require owner access; at minimum document the recommended values)

## Acceptance Criteria

- [x] README is reorganized for first-time visitors with clear install/setup and screenshots.
- [x] FAQ exists at `docs/faq.md` covering the 7 common questions above.
- [x] SECURITY.md and CONTRIBUTING.md are reviewed and current.
- [x] Local markdown link audit passes with zero broken links.
- [x] All docs consistently use "Little Imp" as the product name and `0.1.0-beta` as the current version.

## Dependencies

- TASK-126 (bookmarklet client) — should be documented in README after it ships.
- TASK-129 (first-run guided tour) — screenshots of a populated library are easier after demo content exists.

## Notes

- If the repo is still private when this task runs, use the developer-setup path in Quick Start and mark the one-command install as "coming soon."
- Do not claim public install validation until TASK-142 passes.

## Work Notes

- June 5, 2026: Selected as the next actionable high-priority task because
  TASK-078 and TASK-079 remain blocked by public artifact visibility, while
  TASK-135 can be completed locally without changing product runtime behavior.
- Confirmed with `gh repo view goniszewski/little-imp --json visibility` that
  the repository is still private, and with `curl -I` that the tag-qualified
  raw installer URL returns unauthenticated `404`.
- Rebuilt `README.md` around first-time visitor flow, synthetic screenshots,
  source/Docker quick start, clear public-installer blocker wording, and
  recommended GitHub repository metadata.
- Added `docs/faq.md`, refreshed `SECURITY.md` and `CONTRIBUTING.md`, fixed
  stale task-board links, and added the TASK-135 task report under
  `docs/task-reports/2026/06/2026-06-05-task-135-public-documentation-polish/`.
- Local markdown link audit passed for 19 files across `README.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `docs/*.md`, and `tasks/README.md`.
- Local task-report HTML link audit passed for the root, year, month, and new
  TASK-135 report pages.
