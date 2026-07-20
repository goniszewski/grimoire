# TASK-013: Preferences / Settings API

**Status:** backlog
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

- [ ] API keys never returned in GET response (write-only)
- [ ] Settings persisted to config file on write
- [ ] Frontend PreferencesDialog connects to this endpoint (replaces mock)
- [ ] Test endpoint validates LLM provider is reachable
- [ ] Changing provider clears cached enrichment job statuses
