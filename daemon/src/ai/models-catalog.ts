import { log } from "../logger.js";
import { normalizeHttpsBaseUrl } from "../lib/base-url.js";
import { isPrivateHost } from "../lib/network.js";
import { fetchFollowingSafeRedirects } from "../lib/safe-fetch.js";

/**
 * Model catalog fetching for AI providers.
 * Currently supports OpenRouter, whose catalog endpoint is public
 * (no API key required) and supports a free-model filter.
 */

export type ModelCatalogProvider = "openrouter";

export interface AiModelInfo {
  id: string;
  name: string;
  context_length: number | null;
  prompt_price: string | null;
  completion_price: string | null;
}

export interface ModelCatalogResult {
  provider: ModelCatalogProvider;
  free: boolean;
  fetched_at: string;
  models: AiModelInfo[];
}

export class UnsupportedModelProviderError extends Error {}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CATALOG_BYTES = 10 * 1024 * 1024;
const MAX_RELAYED_MODELS = 10_000;

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNullableInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * OpenRouter reports zero-cost models as pricing "0"/"0" strings.
 * The catalog API's `supported_parameters=free` filter means "has a free
 * variant", so free-only selection must be done on pricing here.
 */
function isFreeModel(raw: Record<string, unknown>): boolean {
  const pricing = (raw.pricing ?? {}) as Record<string, unknown>;
  return pricing.prompt === "0" && pricing.completion === "0";
}

function mapOpenRouterModel(raw: Record<string, unknown>): AiModelInfo | null {
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  const pricing = (raw.pricing ?? {}) as Record<string, unknown>;
  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : raw.id,
    context_length: asNullableInt(raw.context_length),
    prompt_price: asNullableString(pricing.prompt),
    completion_price: asNullableString(pricing.completion),
  };
}

/**
 * Reads a response body with a hard byte cap, so a misbehaving upstream
 * cannot stream unbounded data into the daemon. Throws once the cap is hit.
 */
async function readBodyWithCap(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Model catalog response too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchJsonWithTimeout(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Validate every redirect target before following it. Automatic redirect
    // handling could contact a private intermediate host before this function
    // gets a chance to inspect the final response.
    const res = await fetchFollowingSafeRedirects(url, { signal: controller.signal });
    const finalUrl = res.url || url;
    if (isPrivateHost(new URL(finalUrl).hostname)) {
      res.body?.cancel();
      throw new Error("Model catalog redirected to a private host");
    }
    if (!res.ok) {
      let text = "";
      try {
        text = (await readBodyWithCap(res, 64 * 1024)).toString("utf8");
      } catch {
        // Error body exceeded the cap; keep the generic message.
      }
      log.warn("Model catalog upstream error", { status: res.status, body: text.slice(0, 500) });
      // Do not propagate the upstream body into the API response.
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = await readBodyWithCap(res, MAX_CATALOG_BYTES);
    const json = JSON.parse(buf.toString("utf8")) as unknown;
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      throw new Error("Unexpected model catalog response shape");
    }
    return json as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenRouterModels(baseUrl: string, free: boolean): Promise<AiModelInfo[]> {
  const normalized = normalizeHttpsBaseUrl(baseUrl, OPENROUTER_BASE_URL);
  // Pre-flight SSRF guard: never fetch the catalog from private/loopback hosts.
  const hostname = new URL(normalized).hostname;
  if (isPrivateHost(hostname)) {
    throw new Error(`Refusing to fetch model catalog from private host '${hostname}'`);
  }
  // Accept a base_url that already points at the models endpoint itself.
  const url = `${normalized.replace(/\/models$/i, "")}/models`;
  const json = await fetchJsonWithTimeout(url);
  const rawModels = json.data;
  if (!Array.isArray(rawModels)) {
    throw new Error("Model catalog response is missing the data array");
  }
  const models: AiModelInfo[] = [];
  for (const raw of rawModels) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    if (free && !isFreeModel(record)) continue;
    const model = mapOpenRouterModel(record);
    if (model) models.push(model);
    if (models.length >= MAX_RELAYED_MODELS) {
      log.warn("Model catalog truncated", { limit: MAX_RELAYED_MODELS });
      break;
    }
  }
  return models;
}

export async function listProviderModels(opts: {
  provider: ModelCatalogProvider;
  free: boolean;
  baseUrl?: string;
}): Promise<ModelCatalogResult> {
  if (opts.provider !== "openrouter") {
    throw new UnsupportedModelProviderError(
      `Model catalog is not available for provider '${opts.provider}'`
    );
  }

  const result: ModelCatalogResult = {
    provider: "openrouter",
    free: opts.free,
    fetched_at: new Date().toISOString(),
    models: await fetchOpenRouterModels(opts.baseUrl ?? OPENROUTER_BASE_URL, opts.free),
  };

  log.info("Fetched AI model catalog", { provider: "openrouter", free: opts.free, count: result.models.length });
  return result;
}
