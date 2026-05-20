# TASK-007: LLM Enrichment (Summary, Tags, Category)

**Status:** done
**Priority:** medium
**Phase:** v0-beta
**Area:** backend / ai

## Description

Implement LLM-based enrichment for saved bookmarks: summary generation, tag generation, and category classification — batched into a single LLM call per bookmark.

## Supported Providers

| Provider | Model | Notes |
| -------- | ----- | ----- |
| OpenAI | gpt-4o-mini (default) | ~$0.002/bookmark |
| OpenAI | gpt-4o | ~$0.02/bookmark |
| Local | Ollama-compatible | $0, 5-15s latency |

## Single Prompt Batch

All enrichment tasks are combined into one LLM call that returns:
```json
{
  "summary": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "...",
  "confidence": 0.0-1.0
}
```

## Configuration

Provider and model configured via preferences API / preferences dialog.

## Acceptance Criteria

- [x] Single LLM call returns summary + tags + category
- [x] Provider abstraction supports OpenAI API-compatible endpoints (covers OpenAI + Ollama)
- [x] API key stored in local config file (not in DB)
- [x] Retry transient LLM provider request failures with exponential backoff
      inside the provider client (max 3 attempts)
- [x] Enrichment result stored and bookmark status updated to `ai_enriched`
- [x] Works with local Ollama instance (configurable base URL)
- [x] Prompt is tuned for technical/developer content
- [x] Gracefully degrades if LLM is unavailable (bookmark still usable)

## TASK-058 Review Note

The LLM client retries transient provider errors, but the pipeline treats a
final enrichment failure as non-fatal and continues without AI-generated
summary, tags, or category. Targeted user-triggered enrichment retry is tracked
by TASK-064 and TASK-065.
