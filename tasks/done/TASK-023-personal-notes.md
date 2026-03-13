# TASK-023: Personal Notes on Bookmarks

**Status:** done
**Priority:** high
**Phase:** M1
**Area:** backend / frontend

## Description

Allow users to attach personal Markdown notes to any bookmark. Notes are separate from the AI-generated summary and represent the user's own thoughts.

## Backend

- Migration `0008_bookmark_notes.sql`: add `notes TEXT` column to `bookmarks`
- Extend `PUT /bookmarks/:id` to accept `notes` field
- Update `BookmarkRepository.update()` to handle `notes`
- Include `notes` in `GET /bookmarks/:id` response

## Frontend

- Display `notes` section in `BookmarkDetailContent` below the AI summary
- Read mode: render Markdown using a lightweight renderer (e.g. `marked` or `react-markdown`)
- Write mode: Markdown textarea, toggled by an edit button — consistent with existing inline edit pattern
- Show placeholder text ("Add a personal note…") when notes are empty
- Save on confirm (✓ button), cancel on ✗

## Acceptance Criteria

- [x] Notes render as Markdown in read mode
- [x] Notes are editable inline with a textarea
- [x] Empty notes show a placeholder
- [x] Notes persist across page reload
- [x] Notes field is included in bookmark detail API response
