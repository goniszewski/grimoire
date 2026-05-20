# TASK-013: Preferences / Settings API

**Status:** done
**Priority:** medium
**Phase:** v0-beta
**Area:** backend / api

## Description

Implement a settings API for storing and retrieving user preferences (AI provider config, UI preferences, etc.). Settings stored in a local config file, not the database.

## Config File Location

`~/.config/littleimp/config.json` (or XDG-compliant path)

## Settings Categories

### AI Provider
- `ai.provider`: `openai | ollama | none`
- `ai.openai.api_key`
- `ai.openai.model`: default `gpt-4o-mini`
- `ai.ollama.base_url`: default `http://localhost:11434`
- `ai.ollama.model`
- `ai.embeddings.provider`: `openai | ollama`
- `ai.embeddings.model`

### App Behavior
- `app.autostart`: boolean
- `app.theme`: `light | dark | system`
- `app.lock.enabled`: boolean
- `app.lock.pin_hash`: (hashed)

## Endpoints

- `GET /settings` — read current settings (API keys redacted)
- `PUT /settings` — update settings
- `POST /settings/test-ai` — test LLM provider connectivity

## Acceptance Criteria

- [x] API keys never returned in GET response (write-only)
- [x] Settings persisted to config file on write
- [x] Dedicated Settings page connects to this endpoint (supersedes the old mock PreferencesDialog AI settings)
- [x] Test endpoint validates LLM provider is reachable
- [ ] Changing provider clears cached enrichment job statuses

## TASK-058 Audit Note

Provider settings are now persisted through the dedicated Settings page and used
by runtime AI and embedding execution. Existing bookmarks are not automatically
reprocessed or cleared when providers change; that recovery path is tracked by
TASK-064 and TASK-065.
