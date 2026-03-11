/**
 * Embedding generation via OpenAI-compatible /embeddings endpoint.
 *
 * Works with:
 *   - OpenAI text-embedding-3-small / text-embedding-3-large / text-embedding-ada-002
 *   - Ollama (e.g. nomic-embed-text, mxbai-embed-large)
 *   - Any provider that speaks the OpenAI embeddings API
 *
 * Vector storage: packed float32 little-endian BLOB (mirrors the embeddings table schema).
 */

import { log } from "../logger.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface EmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ─── Float32 BLOB packing ─────────────────────────────────────────────────────

/** Pack a float array into a little-endian Float32 Buffer suitable for SQLite BLOB storage. */
export function packFloat32(values: number[]): Buffer {
  const buf = Buffer.allocUnsafe(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    buf.writeFloatLE(values[i], i * 4);
  }
  return buf;
}

/** Unpack a little-endian Float32 BLOB back into a number array. */
export function unpackFloat32(blob: Uint8Array): number[] {
  const buf = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  const result: number[] = [];
  for (let i = 0; i < buf.byteLength; i += 4) {
    result.push(buf.readFloatLE(i));
  }
  return result;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

/**
 * Cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; 1 = identical direction.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── API client ───────────────────────────────────────────────────────────────

const EMBED_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request an embedding vector for the given text.
 * Returns a float32 array of `dimensions` length.
 */
export async function getEmbedding(
  config: EmbeddingConfig,
  text: string
): Promise<number[]> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/embeddings`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const body = JSON.stringify({ model: config.model, input: text });

  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        const errText = await res.text().catch(() => "");
        lastErr = new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
        log.warn("Embedding request retryable error", { attempt, status: res.status });
        if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Embedding API HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json() as {
        data?: Array<{ embedding?: number[] }>;
      };

      const vector = json?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("Embedding API returned no vector");
      }

      return vector as number[];
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const msg = err instanceof Error ? err.message : String(err);
      // Non-abort errors that aren't transient HTTP errors (already handled above)
      // are not worth retrying — rethrow immediately.
      if (!isAbort) {
        throw err instanceof Error ? err : new Error(msg);
      }
      // Timeout (AbortError) — retryable
      lastErr = new Error(msg);
      log.warn("Embedding request timeout, retrying", { attempt, error: msg });
      if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastErr ?? new Error("Embedding request failed after all retries");
}

// ─── Input text builder ───────────────────────────────────────────────────────

/** Build the text to embed from a bookmark's metadata. */
export function buildEmbedInput(opts: {
  title: string | null;
  summary: string | null;
  tags: string[];
}): string {
  const parts: string[] = [];
  if (opts.title) parts.push(opts.title);
  if (opts.summary) parts.push(opts.summary);
  if (opts.tags.length > 0) parts.push(opts.tags.join(" "));
  return parts.join("\n").slice(0, 8000); // ~2000 tokens, safe for all models
}
