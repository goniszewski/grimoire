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
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (isPrivateIpv4(host)) return true;

  // IPv4-mapped and IPv4-compatible IPv6 literals can address the same
  // private services as their dotted-quad forms (for example,
  // [::ffff:7f00:1] is 127.0.0.1). Classify the embedded address before
  // applying the IPv6-only checks below.
  const embeddedIpv4 = embeddedIpv4Address(host);
  if (embeddedIpv4 && isPrivateIpv4(embeddedIpv4)) return true;

  // Loopback
  if (host === "localhost" || host === "::1") return true;

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
  return host === "0.0.0.0";
}

function embeddedIpv4Address(host: string): string | null {
  if (!host.includes(":")) return null;
  const words = parseIpv6Words(host);
  if (!words || words.length !== 8) return null;

  // The first 80 bits are zero for IPv4-compatible and IPv4-mapped
  // addresses. The sixth word is 0 for compatible or ffff for mapped.
  if (!words.slice(0, 5).every((word) => word === 0) || (words[5] !== 0 && words[5] !== 0xffff)) {
    return null;
  }

  return [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff].join(".");
}

function parseIpv6Words(host: string): number[] | null {
  const sections = host.split("::");
  if (sections.length > 2) return null;

  const parseSection = (section: string): number[] | null => {
    if (!section) return [];
    const groups = section.split(":");
    const words: number[] = [];
    for (const [index, group] of groups.entries()) {
      if (group.includes(".")) {
        if (index !== groups.length - 1) return null;
        const octets = group.split(".");
        if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)) {
          return null;
        }
        words.push((Number(octets[0]) << 8) | Number(octets[1]), (Number(octets[2]) << 8) | Number(octets[3]));
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      words.push(Number.parseInt(group, 16));
    }
    return words;
  };

  const left = parseSection(sections[0]);
  const right = sections.length === 2 ? parseSection(sections[1]) : [];
  if (!left || !right) return null;

  if (sections.length === 1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}
