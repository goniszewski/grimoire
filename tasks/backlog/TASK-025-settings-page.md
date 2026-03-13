# TASK-025: Settings Page (/settings)

**Status:** backlog
**Priority:** high
**Phase:** M2
**Area:** frontend

## Description

Introduce a dedicated `/settings` page (separate from the existing Preferences dialog) where users can configure the daemon's AI and embedding providers without editing env files or config JSON directly.

Backend endpoints already exist: `GET /settings`, `PUT /settings`, `POST /settings/test-ai`.

## Frontend

**Route:** `/settings` (new page, accessible from sidebar nav)

**Sections:**

1. **LLM Provider**
   - Provider selector: OpenAI / Ollama / None
   - Model name input
   - API key input (masked; backend already redacts in responses)
   - Base URL input (shown when Ollama selected)
   - "Test connection" button → calls `POST /settings/test-ai`, shows success/error inline

2. **Embedding Provider**
   - Provider selector: OpenAI / Ollama / None
   - Model name input
   - API key input (masked)
   - Base URL input (shown when Ollama selected)

3. **Save** button — calls `PUT /settings` with deep-merge patch

**UX notes:**
- Unsaved changes indicator
- Validation: API key required when provider is OpenAI
- Success/error toast on save

## Acceptance Criteria

- [ ] `/settings` route renders a dedicated page
- [ ] Current settings load from `GET /settings` on mount
- [ ] API keys are displayed masked
- [ ] "Test connection" shows inline success or error message
- [ ] Save calls `PUT /settings` and shows confirmation toast
- [ ] Settings persist across daemon restarts
- [ ] Sidebar has a link to `/settings`
