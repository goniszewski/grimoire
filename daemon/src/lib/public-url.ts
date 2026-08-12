/**
 * Shared public HTTP(S) URL validation for ingest paths.
 */

import { isPrivateHost } from "./network.js";

export type PublicUrlRejectReason =
  | "invalid"
  | "protocol"
  | "credentials"
  | "private";

export type PublicUrlParseResult =
  | { ok: true; url: URL; href: string }
  | { ok: false; reason: PublicUrlRejectReason };

/**
 * Parse and validate a user-supplied bookmark / update / capture URL.
 * Requires http(s), rejects embedded credentials and private/loopback hosts.
 */
export function parsePublicHttpUrl(raw: string): PublicUrlParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "invalid" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "protocol" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials" };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, reason: "private" };
  }

  return { ok: true, url: parsed, href: trimmed };
}

export function isPublicHttpUrl(raw: string): boolean {
  return parsePublicHttpUrl(raw).ok;
}

/** Redact credentials, query, and fragment for logs / error messages. */
export function redactUrlForLog(raw: string): string {
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function publicUrlRejectionMessage(
  reason: PublicUrlRejectReason,
  field = "url"
): string {
  switch (reason) {
    case "credentials":
      return `\`${field}\` must not include embedded credentials`;
    case "private":
      return `\`${field}\` must not target a private or loopback host`;
    case "protocol":
      return `\`${field}\` must be a valid http or https URL`;
    default:
      return `\`${field}\` must be a valid http or https URL`;
  }
}
