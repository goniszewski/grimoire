/**
 * Shared network utilities.
 */

import { lookup } from "node:dns/promises";

/**
 * Returns true if the hostname is, or syntactically names, a private,
 * loopback, link-local, or otherwise non-routable destination.
 *
 * Used in SSRF mitigations across the codebase. This check is purely
 * syntactic and never touches DNS; callers that fetch over the network should
 * also run {@link resolvesToPrivateAddress} so a public name that points at a
 * private address is rejected.
 */
export function isPrivateHost(hostname: string): boolean {
  // Strip brackets, zone ids, trailing FQDN dots (localhost. / localhost..),
  // and case-fold.
  const host = hostname
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "")
    .replace(/\.+$/g, "")
    .toLowerCase();

  if (!host) return true;

  if (host.includes(":")) return isPrivateIpv6(host);

  const ipv4 = parseIpv4(host);
  if (ipv4) return isPrivateIpv4Octets(ipv4);

  return isInternalHostname(host);
}

/**
 * Resolves `hostname` and returns true if ANY returned address is private.
 * IP literals are classified without a lookup. Lookup failures return false:
 * the subsequent fetch fails on the same name, so there is nothing to protect.
 *
 * Note: the later `fetch` resolves the name again, so a DNS server that
 * answers differently between the two lookups can still win the race. This
 * check defeats static public-name-to-private-IP records, not that race.
 */
export async function resolvesToPrivateAddress(
  hostname: string,
  resolver: HostResolver = defaultResolver
): Promise<boolean> {
  if (isPrivateHost(hostname)) return true;

  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.+$/g, "");
  if (host.includes(":") || parseIpv4(host)) return false;

  let addresses: string[];
  try {
    addresses = await resolver(host);
  } catch {
    return false;
  }
  return addresses.some((address) => isPrivateHost(address));
}

export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((result) => result.address);
};

const INTERNAL_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home.arpa",
];

function isInternalHostname(host: string): boolean {
  if (host === "localhost") return true;
  // Public hosts always have at least two labels; bare names resolve through
  // the local search domain or hosts file (e.g. `instance-data`, `router`).
  if (!host.includes(".")) return true;
  return INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets as [number, number, number, number];
}

function isPrivateIpv4Octets([a, b, c]: [number, number, number, number]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT, RFC 6598
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (AWS IMDS, etc.)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  return a >= 224; // multicast, reserved, broadcast
}

function isPrivateIpv6(host: string): boolean {
  const words = parseIpv6Words(host);
  // Unparseable IPv6 never reaches a legitimate public server.
  if (!words) return true;

  const [w0, w1, w2, w3, w4, w5, w6, w7] = words;
  const embedded = (hi: number, lo: number) =>
    isPrivateIpv4Octets([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);

  // ::, ::1
  if (words.slice(0, 7).every((word) => word === 0) && w7 <= 1) return true;

  // IPv4-compatible (::/96) and IPv4-mapped (::ffff:0:0/96).
  if (words.slice(0, 5).every((word) => word === 0) && (w5 === 0 || w5 === 0xffff)) {
    return embedded(w6, w7);
  }

  if ((w0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((w0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((w0 & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((w0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (w0 === 0x2001 && w1 === 0x0db8) return true; // 2001:db8::/32 documentation
  if (w0 === 0x2001 && w1 === 0) return true; // 2001::/32 Teredo (client IP is obfuscated)
  if (w0 === 0x0100 && w1 === 0 && w2 === 0 && w3 === 0) return true; // 100::/64 discard

  // NAT64: 64:ff9b::/96 embeds an IPv4 address; 64:ff9b:1::/48 is local-use.
  if (w0 === 0x0064 && w1 === 0xff9b) {
    if (w2 === 1) return true;
    if (w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0) return embedded(w6, w7);
  }

  // 6to4: 2002:AABB:CCDD::/48 embeds the IPv4 address in words 1-2.
  if (w0 === 0x2002) return embedded(w1, w2);

  return false;
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
