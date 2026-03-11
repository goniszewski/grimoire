/**
 * Minimal OpenAI-compatible chat-completion client.
 *
 * Supports any provider that speaks the OpenAI chat/completions REST API:
 *   - OpenAI (api.openai.com)
 *   - Ollama  (http://localhost:11434/v1)
 *   - LM Studio, llama.cpp, etc.
 *
 * Features:
 *   - Exponential backoff retry (max 3 attempts)
 *   - Hard per-request timeout (30 s)
 *   - JSON-mode request when the provider supports it (gpt-4o-mini, gpt-4o)
 *   - Structured error types so the pipeline can decide retry vs. skip
 */

import { log } from "../logger.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface LlmConfig {
  /** Base URL of an OpenAI-compatible API. No trailing slash. */
  baseUrl: string;
  /** API key — empty string for local providers (Ollama, LM Studio). */
  apiKey: string;
  /** Chat-completion model name (e.g. "gpt-4o-mini", "llama3"). */
  model: string;
}

// ─── Message types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Error types ─────────────────────────────────────────────────────────────

export class LlmError extends Error {
  constructor(
    message: string,
    /** True if the error is transient and the call should be retried. */
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "LlmError";
  }
}

// ─── Retry helpers ────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Client ───────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Send a chat-completion request with automatic retry on transient errors.
 * Returns the assistant message content string.
 */
export async function chatCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  opts: { jsonMode?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  let lastErr: LlmError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Rate-limit / server error → retryable
      if (res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastErr = new LlmError(`HTTP ${res.status}: ${text.slice(0, 200)}`, true);
        log.warn("LLM request failed (retryable)", {
          attempt,
          status: res.status,
          model: config.model,
        });
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      // Auth / bad request → not retryable
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new LlmError(`HTTP ${res.status}: ${text.slice(0, 200)}`, false);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new LlmError("Failed to parse LLM response JSON", false);
      }

      const content = (json as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content;

      if (typeof content !== "string" || !content.trim()) {
        throw new LlmError("LLM returned empty content", false);
      }

      return content.trim();
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof LlmError) {
        if (!err.retryable) throw err;
        lastErr = err;
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      // AbortError (timeout) → retryable
      const msg = err instanceof Error ? err.message : String(err);
      lastErr = new LlmError(`Request timeout/network error: ${msg}`, true);
      log.warn("LLM request error (retryable)", { attempt, error: msg, model: config.model });
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastErr ?? new LlmError("LLM request failed after all retries", true);
}
