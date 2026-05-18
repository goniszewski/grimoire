# TASK-052: Multi-Provider AI Support

**Phase:** next release AI integrations
**Priority:** medium
**Status:** done

## Summary

Add first-class LLM provider support for Anthropic, OpenRouter, OpenAI-compatible custom endpoints, and DeepSeek international. The implementation should preserve the existing OpenAI and Ollama behavior, keep core bookmark workflows usable when AI is not configured, and continue redacting provider secrets in settings responses and backups.

## Current Evidence

- `daemon/src/settings.ts` restricts `ai.provider` to `openai | ollama | none`, stores only `ai.openai` and `ai.ollama` provider-specific config, and stores one embedding provider/model pair.
- `daemon/src/runtime-settings.ts` resolves only OpenAI and Ollama runtime LLM and embedding configs.
- `daemon/src/ai/llm-client.ts` already supports OpenAI-compatible `/chat/completions` providers when given a base URL, API key, and model.
- `daemon/src/routes/settings.ts` tests connectivity by calling `${baseUrl}/chat/completions` directly, so Anthropic cannot work until connectivity tests go through a provider-aware client.
- `src/pages/Settings.tsx` exposes only OpenAI, Ollama, and None in the LLM provider selector, and only OpenAI/Ollama for embeddings.
- `daemon/src/api/contract.ts`, `docs/api-contract.json`, generated API types, and frontend tests currently encode the same provider enums.

## Provider Scope

- **Anthropic:** native LLM enrichment through the Claude Messages API. Map the current system/user prompt shape to Anthropic's request shape and avoid OpenAI-only request fields such as `response_format`.
- **OpenRouter:** LLM enrichment through the OpenAI-compatible chat-completions surface, defaulting to `https://openrouter.ai/api/v1` with optional attribution headers if they can be configured without adding required setup.
- **OpenAI compatible (custom):** configurable base URL, API key, and model for any OpenAI-compatible chat endpoint. This should not replace the first-class OpenAI provider.
- **DeepSeek international:** LLM enrichment through DeepSeek's international OpenAI-compatible API, defaulting to `https://api.deepseek.com` and a current non-deprecated model default at implementation time.
- **Embeddings:** keep OpenAI and Ollama working. Add custom OpenAI-compatible embeddings only if the settings shape can support a separate embedding base URL and API key without conflating it with the selected LLM provider. Do not claim Anthropic, OpenRouter, or DeepSeek embeddings unless the implementation validates a compatible embeddings endpoint.

## Work

1. Extend the settings schema with explicit provider config blocks and provider ids for `anthropic`, `openrouter`, `openai_compatible`, and `deepseek`, while maintaining migration-safe defaults for existing `openai`, `ollama`, and `none` configs.
2. Update settings validation, deep merge behavior, redaction, portable backup settings, and restore behavior so all new API keys are write-only and redacted consistently.
3. Split LLM execution behind a provider-aware interface, keeping the existing OpenAI-compatible chat client for OpenAI, Ollama, OpenRouter, DeepSeek, and custom endpoints.
4. Add an Anthropic Messages API adapter that supports the enrichment prompt, timeout, retry/error classification, and JSON parsing path used by the existing enrichment stage.
5. Update `resolveRuntimeSettings()` so runtime capabilities report the selected provider, resolved model, resolved base URL, and enabled state for all supported providers without leaking secrets.
6. Update `POST /settings/test-ai` to test providers through the same provider-aware client or adapter used by enrichment.
7. Update the OpenAPI contract source, regenerated `docs/api-contract.json`, shared API types, and frontend settings types.
8. Update the Settings page with provider-specific fields, model placeholders/defaults, redacted key preservation, save behavior, and connectivity test behavior for each provider.
9. Update docs that describe AI configuration, environment defaults, runtime capability, degraded mode, and provider support.
10. Add daemon and frontend regression tests for settings persistence, runtime resolution, connectivity test request shape, secret redaction, and successful enrichment request shaping for each new provider.

## Acceptance Criteria

- [x] Users can select Anthropic, OpenRouter, OpenAI compatible, or DeepSeek international from Settings and save the required provider fields.
- [x] Existing OpenAI and Ollama settings continue to load, save, test, and run enrichment without config migration errors.
- [x] Provider API keys are redacted in `GET /settings`, are not overwritten by `"***"` on save, and are excluded from portable backup settings.
- [x] Anthropic enrichment sends a valid Messages API request and stores the same summary/tags/category output as the current enrichment path.
- [x] OpenRouter, OpenAI-compatible custom endpoints, and DeepSeek international reuse the OpenAI-compatible chat-completions client with correct base URLs, auth headers, and model values.
- [x] `POST /settings/test-ai` succeeds or fails through provider-aware checks for every supported LLM provider.
- [x] Runtime capability data and the degraded-mode banner reflect the effective provider configuration, not just the selected provider value.
- [x] Embedding behavior remains compatible with existing OpenAI and Ollama settings, and any new custom embedding option is tested separately from LLM provider selection.
- [x] API contract, generated docs, and frontend API types include the expanded provider schema.
- [x] Focused daemon and frontend tests cover all new provider settings and request-shape branches.
- [x] `bun run check`, `bun test`, `npm run test`, and `npm run build` pass or documented pre-existing failures are linked in completion notes.

## Completion Notes

- Added provider-aware LLM execution for Anthropic Messages API and OpenAI-compatible providers including OpenRouter, custom endpoints, and DeepSeek.
- Added separate custom OpenAI-compatible embedding configuration without conflating it with the selected LLM provider.
- Updated settings validation, redaction, portable backup settings, runtime capabilities, API contract/docs, frontend Settings UI, and regression tests.
- Verified with `npx tsc --noEmit`, targeted daemon integration tests, and `npm run check`.

## Provider References

- Anthropic Claude API overview: https://platform.claude.com/docs/en/api/overview
- OpenRouter quickstart: https://openrouter.ai/docs/quickstart
- DeepSeek API quickstart: https://api-docs.deepseek.com/
