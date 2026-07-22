/**
 * Fetches a URL and returns the raw HTML body.
 *
 * - Follows redirects manually and validates every target (SSRF defense).
 * - Sends a realistic user-agent to avoid bot-detection rejections.
 * - Hard timeout of 20 seconds.
 * - Only accepts 2xx responses; throws on anything else.
 */

import { fetchFollowingSafeRedirects } from "../lib/safe-fetch.js";
import { parsePublicHttpUrl } from "../lib/public-url.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; LittleImp/0.0; +https://github.com/goniszewski/little-imp)";

const FETCH_TIMEOUT_MS = 20_000;
/** Reject responses larger than this to prevent memory exhaustion. */
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_REDIRECTS = 10;

export interface FetchResult {
  html: string;
  finalUrl: string; // URL after redirects
  contentType: string;
  /** Raw bytes — populated for non-HTML content types (e.g. PDF). */
  bytes?: Uint8Array;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  // Pre-flight SSRF + credentials guard before any network I/O.
  const parsed = parsePublicHttpUrl(url);
  if (!parsed.ok) {
    if (parsed.reason === "private") {
      throw new Error(`Fetch to private host blocked: ${url}`);
    }
    if (parsed.reason === "credentials") {
      throw new Error(`Fetch URL must not include embedded credentials: ${url}`);
    }
    throw new Error(`Invalid URL: ${url}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetchFollowingSafeRedirects(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      maxRedirects: MAX_REDIRECTS,
      skipInitialHostCheck: true,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const finalUrl = res.url || parsed.href;
  // Use the final URL (after redirects) for the extension check — the original URL
  // may have redirected to a different resource type.
  const isPdf = contentType.includes("application/pdf") || finalUrl.toLowerCase().endsWith(".pdf");
  if (
    !isPdf &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml")
  ) {
    throw new Error(`Unexpected content-type "${contentType}" for ${url}`);
  }

  // Reject oversized responses before buffering the body.
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    throw new Error(
      `Response too large (${contentLength} bytes) fetching ${url}`
    );
  }

  // Stream body and enforce size cap to guard against servers that lie about
  // Content-Length or send chunked responses without declaring a length.
  const reader = res.body?.getReader();
  if (!reader) throw new Error(`No response body for ${url}`);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error(`Response exceeded ${MAX_BODY_BYTES} bytes fetching ${url}`);
    }
    chunks.push(value);
  }

  const rawBytes = chunks.reduce((acc, chunk) => {
    const merged = new Uint8Array(acc.byteLength + chunk.byteLength);
    merged.set(acc);
    merged.set(chunk, acc.byteLength);
    return merged;
  }, new Uint8Array(0));

  if (isPdf) {
    return { html: "", finalUrl, contentType, bytes: rawBytes };
  }

  const html = new TextDecoder().decode(rawBytes);
  return { html, finalUrl, contentType };
}
