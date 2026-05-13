import { Config } from "./config.js";
import { settingsManager, Settings } from "./settings.js";
import type { EmbeddingConfig } from "./ai/embeddings.js";
import type { LlmConfig } from "./ai/llm-client.js";

export type RuntimeProvider = "openai" | "ollama" | "none";

export interface EffectiveLlmConfig extends LlmConfig {
  provider: Exclude<RuntimeProvider, "none">;
}

export interface EffectiveEmbeddingConfig extends EmbeddingConfig {
  provider: Exclude<RuntimeProvider, "none">;
}

export interface RuntimeCapability {
  enabled: boolean;
  provider: RuntimeProvider;
  model: string | null;
  base_url: string | null;
}

export interface RuntimeCapabilities {
  llm: RuntimeCapability;
  embeddings: RuntimeCapability;
  capabilities: {
    enrichment: boolean;
    semantic_search: boolean;
    related_bookmarks: boolean;
    organization_agent: boolean;
  };
}

export interface EffectiveRuntimeSettings {
  llmConfig: EffectiveLlmConfig | null;
  embeddingConfig: EffectiveEmbeddingConfig | null;
  runtime: RuntimeCapabilities;
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OLLAMA_BASE_URL = "http://localhost:11434";
const REDACTED_SECRET = "***";

function clean(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSecret(value: string | undefined | null): string {
  const trimmed = clean(value);
  return trimmed === REDACTED_SECRET ? "" : trimmed;
}

function normalizeBaseUrl(raw: string, fallback: string): string {
  return (clean(raw) || fallback).replace(/\/+$/, "");
}

function normalizeOllamaOpenAiBaseUrl(raw: string): string {
  const baseUrl = normalizeBaseUrl(raw, OLLAMA_BASE_URL);
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function resolveLlmConfig(settings: Settings): EffectiveLlmConfig | null {
  if (settings.ai.provider === "none") return null;

  if (settings.ai.provider === "openai") {
    const apiKey = cleanSecret(settings.ai.openai.api_key) || cleanSecret(Config.LLM_API_KEY);
    const model = clean(settings.ai.openai.model) || Config.LLM_MODEL;
    if (!apiKey || !model) return null;
    return {
      provider: "openai",
      baseUrl: normalizeBaseUrl(Config.LLM_BASE_URL, OPENAI_BASE_URL),
      apiKey,
      model,
    };
  }

  const model = clean(settings.ai.ollama.model);
  if (!model) return null;
  return {
    provider: "ollama",
    baseUrl: normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url),
    apiKey: "",
    model,
  };
}

function resolveEmbeddingConfig(settings: Settings): EffectiveEmbeddingConfig | null {
  const model = clean(settings.ai.embeddings.model) || Config.EMBEDDING_MODEL;
  if (!model) return null;

  if (settings.ai.embeddings.provider === "openai") {
    const apiKey =
      cleanSecret(settings.ai.openai.api_key) ||
      cleanSecret(Config.EMBEDDING_API_KEY) ||
      cleanSecret(Config.LLM_API_KEY);
    if (!apiKey) return null;
    return {
      provider: "openai",
      baseUrl: normalizeBaseUrl(Config.EMBEDDING_BASE_URL, OPENAI_BASE_URL),
      apiKey,
      model,
    };
  }

  return {
    provider: "ollama",
    baseUrl: normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url),
    apiKey: "",
    model,
  };
}

function runtimeCapability(
  provider: RuntimeProvider,
  model: string | null,
  baseUrl: string | null,
  effective: EffectiveLlmConfig | EffectiveEmbeddingConfig | null
): RuntimeCapability {
  return {
    enabled: effective !== null,
    provider: effective?.provider ?? provider,
    model: effective?.model ?? model,
    base_url: effective?.baseUrl ?? baseUrl,
  };
}

function configuredLlmModel(settings: Settings): string | null {
  if (settings.ai.provider === "openai") return clean(settings.ai.openai.model) || Config.LLM_MODEL;
  if (settings.ai.provider === "ollama") return clean(settings.ai.ollama.model) || null;
  return null;
}

function configuredLlmBaseUrl(settings: Settings): string | null {
  if (settings.ai.provider === "openai") return normalizeBaseUrl(Config.LLM_BASE_URL, OPENAI_BASE_URL);
  if (settings.ai.provider === "ollama") return normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url);
  return null;
}

function configuredEmbeddingBaseUrl(settings: Settings): string | null {
  if (settings.ai.embeddings.provider === "openai") {
    return normalizeBaseUrl(Config.EMBEDDING_BASE_URL, OPENAI_BASE_URL);
  }
  return normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url);
}

export function resolveRuntimeSettings(
  settings: Settings = settingsManager.read()
): EffectiveRuntimeSettings {
  const llmConfig = resolveLlmConfig(settings);
  const embeddingConfig = resolveEmbeddingConfig(settings);

  const runtime: RuntimeCapabilities = {
    llm: runtimeCapability(
      settings.ai.provider,
      configuredLlmModel(settings),
      configuredLlmBaseUrl(settings),
      llmConfig
    ),
    embeddings: runtimeCapability(
      settings.ai.embeddings.provider,
      clean(settings.ai.embeddings.model) || Config.EMBEDDING_MODEL,
      configuredEmbeddingBaseUrl(settings),
      embeddingConfig
    ),
    capabilities: {
      enrichment: llmConfig !== null,
      semantic_search: embeddingConfig !== null,
      related_bookmarks: embeddingConfig !== null,
      organization_agent: embeddingConfig !== null,
    },
  };

  return { llmConfig, embeddingConfig, runtime };
}
