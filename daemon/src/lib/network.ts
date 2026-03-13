/**
 * Shared network utilities.
 */

/**
 * Returns true if the hostname resolves to a private, loopback, link-local,
 * or otherwise non-routable address.
 *
 * Used in SSRF mitigations across the codebase.
 * NOTE: This is a best-effort syntactic check. DNS rebinding (a public hostname
 * that resolves to a private IP at fetch time) is not mitigated here and is
 * considered an accepted risk for a local-only daemon.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");

  // Loopback
  if (host === "localhost" || host === "::1") return true;
  if (/^127\./.test(host)) return true;

  // Link-local (AWS IMDS, etc.)
  if (/^169\.254\./.test(host)) return true;
  if (/^fe80:/i.test(host)) return true;

  // IPv6 ULA (Unique Local Address, RFC 4193) — fc00::/7 covers fc** and fd**
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;

  // IPv6 site-local (deprecated but still routable internally)
  if (/^fec[0-9a-f]:/i.test(host)) return true;

  // Private ranges
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;

  // CGNAT / shared address space (RFC 6598)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;

  // Unspecified / broadcast
  if (host === "0.0.0.0" || host === "::") return true;

  return false;
}
