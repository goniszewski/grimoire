import { Config } from "./config.js";
import { settingsManager } from "./settings.js";
import type { AiProvider, EmbeddingProvider, Settings } from "./settings.js";
import type { EmbeddingConfig } from "./ai/embeddings.js";
import type { ProviderLlmConfig } from "./ai/llm-provider.js";

export type RuntimeProvider = AiProvider | EmbeddingProvider;

export type EffectiveLlmConfig = ProviderLlmConfig;

export interface EffectiveEmbeddingConfig extends EmbeddingConfig {
  provider: EmbeddingProvider;
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
const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const OPENROUTER_TITLE = "Grimoire";
const REDACTED_SECRET = "***";
const AI_PROVIDERS = new Set<AiProvider>([
  "openai",
  "ollama",
  "anthropic",
  "openrouter",
  "openai_compatible",
  "deepseek",
  "none",
]);
const EMBEDDING_PROVIDERS = new Set<EmbeddingProvider>([
  "openai",
  "ollama",
  "openai_compatible",
]);

function clean(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSecret(value: string | undefined | null): string {
  const trimmed = clean(value);
  return trimmed === REDACTED_SECRET ? "" : trimmed;
}

function selectedAiProvider(settings: Settings): AiProvider {
  const provider = settings.ai.provider as unknown;
  return typeof provider === "string" && AI_PROVIDERS.has(provider as AiProvider)
    ? (provider as AiProvider)
    : "none";
}

function selectedEmbeddingProvider(settings: Settings): EmbeddingProvider | "none" {
  const provider = settings.ai.embeddings.provider as unknown;
  return typeof provider === "string" && EMBEDDING_PROVIDERS.has(provider as EmbeddingProvider)
    ? (provider as EmbeddingProvider)
    : "none";
}

function normalizeBaseUrl(raw: string, fallback: string): string {
  return (clean(raw) || fallback).replace(/\/+$/, "");
}

function normalizeOllamaOpenAiBaseUrl(raw: string): string {
  const baseUrl = normalizeBaseUrl(raw, OLLAMA_BASE_URL);
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function normalizeAnthropicBaseUrl(raw: string): string {
  const baseUrl = normalizeBaseUrl(raw, ANTHROPIC_BASE_URL);
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function resolveLlmConfig(settings: Settings): EffectiveLlmConfig | null {
  const provider = selectedAiProvider(settings);
  if (provider === "none") return null;

  if (provider === "openai") {
    const apiKey = cleanSecret(settings.ai.openai.api_key) || cleanSecret(Config.LLM_API_KEY);
    const model = clean(settings.ai.openai.model) || Config.LLM_MODEL;
    if (!apiKey || !model) return null;
    return {
      kind: "openai-compatible",
      provider: "openai",
      baseUrl: normalizeBaseUrl(Config.LLM_BASE_URL, OPENAI_BASE_URL),
      apiKey,
      model,
    };
  }

  if (provider === "ollama") {
    const model = clean(settings.ai.ollama.model);
    if (!model) return null;
    return {
      kind: "openai-compatible",
      provider: "ollama",
      baseUrl: normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url),
      apiKey: "",
      model,
    };
  }

  if (provider === "anthropic") {
    const apiKey = cleanSecret(settings.ai.anthropic.api_key);
    const model = clean(settings.ai.anthropic.model);
    if (!apiKey || !model) return null;
    return {
      kind: "anthropic",
      provider: "anthropic",
      baseUrl: normalizeAnthropicBaseUrl(settings.ai.anthropic.base_url),
      apiKey,
      model,
    };
  }

  if (provider === "openrouter") {
    const apiKey = cleanSecret(settings.ai.openrouter.api_key);
    const model = clean(settings.ai.openrouter.model);
    if (!apiKey || !model) return null;
    return {
      kind: "openai-compatible",
      provider: "openrouter",
      baseUrl: normalizeBaseUrl(settings.ai.openrouter.base_url, OPENROUTER_BASE_URL),
      apiKey,
      model,
      headers: { "X-OpenRouter-Title": OPENROUTER_TITLE },
    };
  }

  if (provider === "openai_compatible") {
    const model = clean(settings.ai.openai_compatible.model);
    const baseUrl = normalizeBaseUrl(settings.ai.openai_compatible.base_url, "");
    if (!baseUrl || !model) return null;
    return {
      kind: "openai-compatible",
      provider: "openai_compatible",
      baseUrl,
      apiKey: cleanSecret(settings.ai.openai_compatible.api_key),
      model,
    };
  }

  if (provider === "deepseek") {
    const apiKey = cleanSecret(settings.ai.deepseek.api_key);
    const model = clean(settings.ai.deepseek.model);
    if (!apiKey || !model) return null;
    return {
      kind: "openai-compatible",
      provider: "deepseek",
      baseUrl: normalizeBaseUrl(settings.ai.deepseek.base_url, DEEPSEEK_BASE_URL),
      apiKey,
      model,
    };
  }

  return null;
}

function resolveEmbeddingConfig(settings: Settings): EffectiveEmbeddingConfig | null {
  const provider = selectedEmbeddingProvider(settings);
  if (provider === "none") return null;

  if (provider === "openai") {
    const model = clean(settings.ai.embeddings.model) || Config.EMBEDDING_MODEL;
    const apiKey =
      cleanSecret(settings.ai.openai.api_key) ||
      cleanSecret(Config.EMBEDDING_API_KEY) ||
      cleanSecret(Config.LLM_API_KEY);
    if (!apiKey || !model) return null;
    return {
      provider: "openai",
      baseUrl: normalizeBaseUrl(Config.EMBEDDING_BASE_URL, OPENAI_BASE_URL),
      apiKey,
      model,
    };
  }

  if (provider === "ollama") {
    const model = clean(settings.ai.embeddings.model) || Config.EMBEDDING_MODEL;
    if (!model) return null;
    return {
      provider: "ollama",
      baseUrl: normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url),
      apiKey: "",
      model,
    };
  }

  if (provider === "openai_compatible") {
    const model = clean(settings.ai.embeddings.openai_compatible.model);
    const baseUrl = normalizeBaseUrl(settings.ai.embeddings.openai_compatible.base_url, "");
    if (!baseUrl || !model) return null;
    return {
      provider: "openai_compatible",
      baseUrl,
      apiKey: cleanSecret(settings.ai.embeddings.openai_compatible.api_key),
      model,
    };
  }

  return null;
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
  const provider = selectedAiProvider(settings);
  if (provider === "openai") return clean(settings.ai.openai.model) || Config.LLM_MODEL;
  if (provider === "ollama") return clean(settings.ai.ollama.model) || null;
  if (provider === "anthropic") return clean(settings.ai.anthropic.model) || null;
  if (provider === "openrouter") return clean(settings.ai.openrouter.model) || null;
  if (provider === "openai_compatible") return clean(settings.ai.openai_compatible.model) || null;
  if (provider === "deepseek") return clean(settings.ai.deepseek.model) || null;
  return null;
}

function configuredLlmBaseUrl(settings: Settings): string | null {
  const provider = selectedAiProvider(settings);
  if (provider === "openai") return normalizeBaseUrl(Config.LLM_BASE_URL, OPENAI_BASE_URL);
  if (provider === "ollama") return normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url);
  if (provider === "anthropic") return normalizeAnthropicBaseUrl(settings.ai.anthropic.base_url);
  if (provider === "openrouter") return normalizeBaseUrl(settings.ai.openrouter.base_url, OPENROUTER_BASE_URL);
  if (provider === "openai_compatible") return normalizeBaseUrl(settings.ai.openai_compatible.base_url, "");
  if (provider === "deepseek") return normalizeBaseUrl(settings.ai.deepseek.base_url, DEEPSEEK_BASE_URL);
  return null;
}

function configuredEmbeddingBaseUrl(settings: Settings): string | null {
  const provider = selectedEmbeddingProvider(settings);
  if (provider === "openai") {
    return normalizeBaseUrl(Config.EMBEDDING_BASE_URL, OPENAI_BASE_URL);
  }
  if (provider === "ollama") {
    return normalizeOllamaOpenAiBaseUrl(settings.ai.ollama.base_url);
  }
  if (provider === "openai_compatible") {
    return normalizeBaseUrl(settings.ai.embeddings.openai_compatible.base_url, "");
  }
  return null;
}

function configuredEmbeddingModel(settings: Settings): string | null {
  const provider = selectedEmbeddingProvider(settings);
  if (provider === "openai" || provider === "ollama") {
    return clean(settings.ai.embeddings.model) || Config.EMBEDDING_MODEL;
  }
  if (provider === "openai_compatible") {
    return clean(settings.ai.embeddings.openai_compatible.model) || null;
  }
  return null;
}

export function resolveRuntimeSettings(
  settings: Settings = settingsManager.read()
): EffectiveRuntimeSettings {
  const llmConfig = resolveLlmConfig(settings);
  const embeddingConfig = resolveEmbeddingConfig(settings);

  const runtime: RuntimeCapabilities = {
    llm: runtimeCapability(
      selectedAiProvider(settings),
      configuredLlmModel(settings),
      configuredLlmBaseUrl(settings),
      llmConfig
    ),
    embeddings: runtimeCapability(
      selectedEmbeddingProvider(settings),
      configuredEmbeddingModel(settings),
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
