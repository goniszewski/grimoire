/**
 * Shared strict normalization for provider base URLs.
 * Parses with `new URL`, requires http/https, and returns
 * `origin + pathname` with no trailing slash (query/hash dropped).
 * Throws on invalid or unsupported URLs.
 */
export function normalizeHttpsBaseUrl(raw: string, fallback: string): string {
  const base = raw.trim() || fallback;
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`Invalid base URL: ${base}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Base URL must use http or https");
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}
