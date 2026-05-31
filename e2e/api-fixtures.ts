import type {
  BookmarkDto,
  HealthResponseDto,
  SettingsDto,
  SettingsResponseDto,
} from "../daemon/src/api/types";

export const BASE = "http://127.0.0.1:3210";

export function makeApiBookmark(overrides: Partial<BookmarkDto> = {}): BookmarkDto {
  return {
    id: "bm-test-1",
    url: "https://playwright.dev/docs/intro",
    domain: "playwright.dev",
    title: "Introduction | Playwright",
    description: "Playwright enables reliable end-to-end testing",
    status: "ai_enriched",
    category_id: null,
    favicon_url: null,
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_later: 0,
    read_at: null,
    opened_count: 0,
    last_opened_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ["testing", "e2e"],
    ...overrides,
  };
}

export function makeHealthResponse(): HealthResponseDto {
  return { status: "ok", version: "0.0.0", uptime: 100, queueSize: 0 };
}

export function makeSettings(aiProvider: SettingsDto["ai"]["provider"] = "none"): SettingsDto {
  const enrichmentEnabled = aiProvider !== "none";
  const openaiConfigured = aiProvider === "openai";
  const ollamaConfigured = aiProvider === "ollama";
  const embeddingsEnabled = openaiConfigured;

  return {
    ai: {
      provider: aiProvider,
      openai: { api_key: openaiConfigured ? "***" : "", model: "gpt-4o-mini" },
      ollama: { base_url: "http://localhost:11434", model: "llama3" },
      anthropic: {
        api_key: "",
        base_url: "https://api.anthropic.com",
        model: "claude-sonnet-4-6",
      },
      openrouter: {
        api_key: "",
        base_url: "https://openrouter.ai/api/v1",
        model: "~openai/gpt-latest",
      },
      openai_compatible: {
        api_key: "",
        base_url: "http://localhost:8000/v1",
        model: "custom-chat-model",
      },
      deepseek: {
        api_key: "",
        base_url: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
      embeddings: {
        provider: "openai",
        model: "text-embedding-3-small",
        openai_compatible: {
          api_key: "",
          base_url: "http://localhost:8000/v1",
          model: "custom-embedding-model",
        },
      },
    },
    app: {
      autostart: false,
      theme: "system",
      lock: { enabled: false, pin_hash: "" },
    },
    backup: {
      local: { destination_path: "" },
      schedule: { enabled: false, cron: "0 3 * * *", retention_count: 7 },
      s3: {
        endpoint: "",
        bucket: "",
        access_key: "",
        secret_key: "",
        region: "us-east-1",
        prefix: "little-imp-backups/",
      },
    },
    runtime: {
      llm: {
        enabled: enrichmentEnabled,
        provider: aiProvider,
        model: openaiConfigured ? "gpt-4o-mini" : ollamaConfigured ? "llama3" : null,
        base_url: openaiConfigured
          ? "https://api.openai.com/v1"
          : ollamaConfigured
            ? "http://localhost:11434/v1"
            : null,
      },
      embeddings: {
        enabled: embeddingsEnabled,
        provider: "openai",
        model: "text-embedding-3-small",
        base_url: "https://api.openai.com/v1",
      },
      capabilities: {
        enrichment: enrichmentEnabled,
        semantic_search: embeddingsEnabled,
        related_bookmarks: embeddingsEnabled,
        organization_agent: false,
      },
    },
  };
}

export function makeSettingsResponse(
  aiProvider: SettingsDto["ai"]["provider"] = "none"
): SettingsResponseDto {
  return { data: makeSettings(aiProvider) };
}
