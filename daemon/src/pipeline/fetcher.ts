/**
 * Fetches a URL and returns the raw HTML body.
 *
 * - Follows up to 10 redirects automatically (Bun/fetch default).
 * - Sends a realistic user-agent to avoid bot-detection rejections.
 * - Hard timeout of 20 seconds.
 * - Only accepts 2xx responses; throws on anything else.
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; LittleImp/0.0; +https://github.com/goniszewski/little-imp)";

const FETCH_TIMEOUT_MS = 20_000;

/** Same private-host check used by the bookmarks route — applied to the *final* URL after redirects. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  if (/^127\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^fe80:/i.test(host)) return true;
  if (/^fec[0-9a-f]:/i.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;
  if (host === "0.0.0.0" || host === "::") return true;
  return false;
}
/** Reject responses larger than this to prevent memory exhaustion. */
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FetchResult {
  html: string;
  finalUrl: string; // URL after redirects
  contentType: string;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  // Guard against SSRF via open redirects: validate the *final* URL after redirect chain.
  try {
    const finalHost = new URL(res.url).hostname;
    if (isPrivateHost(finalHost)) {
      throw new Error(`Redirect to private host blocked: ${res.url}`);
    }
  } catch (e) {
    if ((e as Error).message.startsWith("Redirect to private host")) throw e;
    throw new Error(`Invalid final URL after redirect: ${res.url}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
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

  const html = new TextDecoder().decode(
    chunks.reduce((acc, chunk) => {
      const merged = new Uint8Array(acc.byteLength + chunk.byteLength);
      merged.set(acc);
      merged.set(chunk, acc.byteLength);
      return merged;
    }, new Uint8Array(0))
  );

  return { html, finalUrl: res.url, contentType };
}
