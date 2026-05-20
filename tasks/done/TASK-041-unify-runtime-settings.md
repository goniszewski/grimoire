# TASK-041: Unify Runtime Settings with AI and Embedding Execution

**Status:** done
**Priority:** high
**Phase:** v0-beta hardening
**Area:** daemon, frontend, AI

## Description

The Settings page persists AI and embedding preferences to `~/.config/littleimp/config.json`, but the daemon execution paths still read static environment variables through `Config`. This means a user can save and test AI settings in the UI while ingestion, semantic search, related bookmarks, MCP search, and the organization agent still behave as if AI is disabled.

This task makes the persisted Settings API the runtime source of truth for AI and embedding configuration, while keeping environment variables as install-time defaults.

## Current evidence

- `settingsManager.write()` persists settings to a JSON config file.
- `daemon/src/settings.ts` stores nested `ai.provider`, `ai.openai`, `ai.ollama`, and `ai.embeddings` settings, while environment variables still live in `daemon/src/config.ts`.
- `runPipeline()` gates enrichment and embeddings on `Config.LLM_API_KEY` and `Config.EMBEDDING_API_KEY`.
- `/search` and `/bookmarks/:id/related` gate semantic features on `Config.EMBEDDING_API_KEY`.
- MCP search and the organization agent also read embedding config from `Config`.
- `useSettings()` treats any non-`none` AI provider as enabled, even if the runtime path still lacks a usable key/base URL.

## Dependencies / sequencing

- This should land before TASK-042 so Docker examples can use the real settings model.
- This should land before TASK-047 so the release docs describe the final configuration precedence.
- Coordinate with TASK-046 for shared frontend settings types, but do not wait on the full API-contract refactor to fix runtime behavior.

## Work

1. Add a daemon helper that resolves effective AI and embedding config from `settingsManager.read()` with environment defaults as install-time fallback.
2. Support OpenAI LLM enrichment, Ollama LLM enrichment, OpenAI embeddings, and Ollama embeddings from the persisted nested settings schema.
3. Update the ingestion pipeline to use live settings for enrichment and embeddings.
4. Update `/search`, `/bookmarks/:id/related`, MCP search, and the organization agent to use the same effective embedding config.
5. Expose effective runtime capabilities through a daemon response that the frontend can read without receiving secrets.
6. Make the frontend degraded-mode banner reflect effective runtime capability, not just `ai.provider`.
7. Ensure redacted keys returned by `GET /settings` are never written back as literal `"***"` values by UI save flows.
8. Update README/API docs to explain precedence between env defaults and persisted settings.
9. Add regression tests proving that `PUT /settings` affects subsequent pipeline and search behavior without editing `.env`.

## Acceptance Criteria

- [x] Saving OpenAI settings through `PUT /settings` enables LLM enrichment for newly ingested bookmarks without daemon env changes.
- [x] Saving embedding settings through `PUT /settings` enables semantic/hybrid search and related bookmarks without daemon env changes.
- [x] Ollama settings resolve to valid local LLM and embedding endpoints.
- [x] MCP search uses the same embedding configuration as REST search.
- [x] The degraded-mode banner matches actual runtime capability.
- [x] Frontend settings saves do not overwrite stored secrets with redacted placeholder values.
- [x] Unit or integration tests cover settings-driven enrichment and settings-driven semantic search.
- [x] `bun run check`, `bun test`, `npm run test`, and `npm run build` pass.

## Completion Notes

Implemented with runtime settings resolution for pipeline enrichment, embeddings, REST search, related bookmarks, MCP search, and organization suggestions. `GET /settings` now reports effective runtime capability without secrets, and redacted secret placeholders are ignored on save.

Verification originally passed for `bun test`, `npm run test`,
`npm run build`, `npx tsc --noEmit`, and `git diff --check`.

TASK-058 audit update: the stale quality-gate note is now resolved. `npm run check`
passes, including daemon `bun run check`, daemon `bun test`, frontend
`npm run test`, API docs drift check, and production build. Root lint still
emits existing warnings, but no lint errors.
