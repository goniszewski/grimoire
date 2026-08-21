/**
 * Shared network utilities.
 */

/**
 * If `host` is an IPv4-mapped or IPv4-compatible IPv6 literal, return the
 * embedded dotted-quad IPv4 string; otherwise null.
 *
 * WHATWG URL normalizes mapped forms to e.g. `[::ffff:c0a8:101]`.
 */
function embeddedIpv4FromIpv6(host: string): string | null {
  const h = host.toLowerCase();

  // ::ffff:a.b.c.d (or …:ffff:a.b.c.d before normalization)
  const mappedDotted = /(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (mappedDotted) return mappedDotted[1];

  // ::ffff:hhhh:hhhh
  const mappedHex = /(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1]!, 16);
    const lo = Number.parseInt(mappedHex[2]!, 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  // Deprecated IPv4-compatible ::a.b.c.d
  const compatDotted = /^::(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (compatDotted) return compatDotted[1];

  // Deprecated IPv4-compatible ::hhhh:hhhh (e.g. ::7f00:1 → 127.0.0.1).
  // Exclude ::ffff:… (handled above) and bare ::1 (IPv6 loopback).
  if (h === "::1") return null;
  const compatHex = /^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (compatHex && compatHex[1] !== "ffff") {
    const hi = Number.parseInt(compatHex[1]!, 16);
    const lo = Number.parseInt(compatHex[2]!, 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  return null;
}

function isPrivateIpv4(host: string): boolean {
  // Loopback
  if (/^127\./.test(host)) return true;

  // Link-local (AWS IMDS, etc.)
  if (/^169\.254\./.test(host)) return true;

  // Private ranges
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;

  // CGNAT / shared address space (RFC 6598)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;

  // Unspecified / broadcast
  if (host === "0.0.0.0") return true;

  return false;
}

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
  // Strip brackets, trailing FQDN dots (localhost. / localhost..), and case-fold.
  const host = hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/g, "")
    .toLowerCase();

  // Loopback
  if (host === "localhost" || host === "::1") return true;

  const embedded = embeddedIpv4FromIpv6(host);
  if (embedded && isPrivateIpv4(embedded)) return true;

  // Native IPv4 / IPv6 checks (and public IPv4-mapped that embeds a public IPv4)
  if (isPrivateIpv4(host)) return true;

  // Link-local IPv6
  if (/^fe80:/.test(host)) return true;

  // IPv6 ULA (Unique Local Address, RFC 4193) — fc00::/7 covers fc** and fd**
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;

  // IPv6 site-local (deprecated but still routable internally)
  if (/^fec[0-9a-f]:/.test(host)) return true;

  // Unspecified IPv6
  if (host === "::") return true;

  return false;
}
