import { ChatMessage, LlmConfig, LlmError, chatCompletion } from "./llm-client.js";
import { log } from "../logger.js";

export type OpenAiCompatibleLlmProvider =
  | "openai"
  | "ollama"
  | "openrouter"
  | "openai_compatible"
  | "deepseek";

export interface OpenAiCompatibleLlmConfig extends LlmConfig {
  kind: "openai-compatible";
  provider: OpenAiCompatibleLlmProvider;
}

export interface AnthropicLlmConfig {
  kind: "anthropic";
  provider: "anthropic";
  /** Base URL including /v1 and no trailing slash. */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type ProviderLlmConfig = OpenAiCompatibleLlmConfig | AnthropicLlmConfig;

const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function anthropicMessagesUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/messages`;
}

function anthropicRequestBody(
  config: AnthropicLlmConfig,
  messages: ChatMessage[],
  opts: { maxTokens?: number }
): Record<string, unknown> {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

  return {
    model: config.model,
    max_tokens: opts.maxTokens ?? 1024,
    ...(system ? { system } : {}),
    messages: conversation,
    temperature: 0.2,
  };
}

function anthropicText(json: unknown): string {
  const blocks = (json as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function anthropicMessages(
  config: AnthropicLlmConfig,
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {}
): Promise<string> {
  const url = anthropicMessagesUrl(config.baseUrl);
  const body = anthropicRequestBody(config, messages, opts);
  let lastErr: LlmError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": ANTHROPIC_VERSION,
          "x-api-key": config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastErr = new LlmError(`HTTP ${res.status}: ${text.slice(0, 200)}`, true);
        log.warn("Anthropic request failed (retryable)", {
          attempt,
          status: res.status,
          model: config.model,
        });
        if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new LlmError(`HTTP ${res.status}: ${text.slice(0, 200)}`, false);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new LlmError("Failed to parse Anthropic response JSON", false);
      }

      const content = anthropicText(json);
      if (!content) {
        throw new LlmError("Anthropic returned empty content", false);
      }

      return content;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof LlmError) {
        if (!err.retryable) throw err;
        lastErr = err;
        if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      const msg = err instanceof Error ? err.message : String(err);
      lastErr = new LlmError(`Request timeout/network error: ${msg}`, true);
      log.warn("Anthropic request error (retryable)", { attempt, error: msg, model: config.model });
      if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastErr ?? new LlmError("Anthropic request failed after all retries", true);
}

export async function providerChatCompletion(
  config: ProviderLlmConfig | LlmConfig,
  messages: ChatMessage[],
  opts: { jsonMode?: boolean; maxTokens?: number } = {}
): Promise<string> {
  if ("kind" in config && config.kind === "anthropic") {
    return anthropicMessages(config, messages, { maxTokens: opts.maxTokens });
  }
  return chatCompletion(config, messages, opts);
}

export async function testProviderConnection(config: ProviderLlmConfig): Promise<void> {
  try {
    await providerChatCompletion(
      config,
      [{ role: "user", content: "ping" }],
      { maxTokens: 1 }
    );
  } catch (err) {
    if (err instanceof LlmError && err.message.startsWith("HTTP 400:")) {
      return;
    }
    throw err;
  }
}
