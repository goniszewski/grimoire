/**
 * Outbound fetch helpers with manual redirect validation (SSRF defense).
 */

import { isPrivateHost } from "./network.js";
import { parsePublicHttpUrl } from "./public-url.js";

const DEFAULT_MAX_REDIRECTS = 10;

export function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

export function resolveSafeRedirectUrl(
  location: string | null,
  base: URL
): URL | null {
  if (!location?.trim()) return null;
  let next: URL;
  try {
    next = new URL(location, base);
  } catch {
    return null;
  }
  const parsed = parsePublicHttpUrl(next.toString());
  if (!parsed.ok) return null;
  return parsed.url;
}

export interface SafeFetchOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
  maxRedirects?: number;
  /** When true, skip the initial private-host check (caller already validated). */
  skipInitialHostCheck?: boolean;
}

/**
 * Fetch a URL while validating every redirect target before following it.
 * Never uses automatic redirect following, so private intermediates are never contacted.
 */
export async function fetchFollowingSafeRedirects(
  inputUrl: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  let current: URL;
  try {
    current = new URL(inputUrl);
  } catch {
    throw new Error(`Invalid URL: ${inputUrl}`);
  }

  if (!options.skipInitialHostCheck && isPrivateHost(current.hostname)) {
    throw new Error(`Fetch to private host blocked: ${inputUrl}`);
  }

  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    response = await fetch(current.toString(), {
      headers: options.headers,
      redirect: "manual",
      signal: options.signal,
    });

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const next = resolveSafeRedirectUrl(response.headers.get("location"), current);
    await response.body?.cancel().catch(() => undefined);
    if (!next) {
      throw new Error(`Redirect to private or invalid host blocked from: ${current.toString()}`);
    }
    current = next;
  }

  throw new Error(`Too many redirects fetching ${inputUrl}`);
}
