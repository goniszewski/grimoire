/**
 * Parameterized share link: `/add?url=…&title=…&note=…&tags=a,b`.
 *
 * All parameters are untrusted input (bookmarklets, scripts, Android share
 * targets, or any web page that can link here). They are only ever used as
 * form values / text, never as HTML.
 */
import { listBookmarks } from "@/lib/api";
import type { ApiBookmark } from "@/lib/api";
import { isSafeExternalBookmarkUrl } from "@/lib/safe-url";

export const SHARE_LINK_PATH = "/add";
export const SHARE_LIMITS = {
  url: 2048,
  title: 300,
  note: 10_000,
  tags: 20,
  tagLength: 50,
} as const;

export interface SharePrefill {
  url: string;
  title: string;
  notes: string;
  tags: string[];
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value: string | null, max: number, keepNewlines = false): string {
  if (!value) return "";
  let out = value.replace(CONTROL_CHARS, "");
  if (!keepNewlines) out = out.replace(/[\r\n\t]+/g, " ");
  return out.trim().slice(0, max).trim();
}

/** Returns a sanitized prefill, or null when the link carries nothing usable. */
export function parseShareLinkParams(params: URLSearchParams): SharePrefill | null {
  const rawUrl = (params.get("url") ?? "").trim();
  const url = rawUrl.length <= SHARE_LIMITS.url && isSafeExternalBookmarkUrl(rawUrl) ? rawUrl : "";
  const title = clean(params.get("title"), SHARE_LIMITS.title);
  const notes = clean(params.get("note") ?? params.get("notes"), SHARE_LIMITS.note, true);
  const tags: string[] = [];
  for (const piece of (params.get("tags") ?? "").split(",")) {
    const tag = clean(piece, SHARE_LIMITS.tagLength).toLowerCase();
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= SHARE_LIMITS.tags) break;
  }
  if (!url && !title && !notes && tags.length === 0) return null;
  return { url, title, notes, tags };
}

const LOOKUP_PAGE_SIZE = 100;
const LOOKUP_MAX_PAGES = 10;

/**
 * Finds an active (not archived/trashed) bookmark with exactly this URL.
 * Uses the existing list API filtered by domain; the daemon stores the domain
 * as `new URL(url).hostname` and de-duplicates on exact URL equality.
 */
export async function findActiveBookmarkByUrl(url: string): Promise<ApiBookmark | null> {
  let hostname: string;
  let href: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    href = parsed.href;
  } catch {
    return null;
  }
  for (let page = 0; page < LOOKUP_MAX_PAGES; page += 1) {
    const res = await listBookmarks({ domain: hostname, limit: LOOKUP_PAGE_SIZE, offset: page * LOOKUP_PAGE_SIZE });
    const items = res.data as unknown as ApiBookmark[];
    const match = items.find((b) => !b.is_archived && (b.url === url || b.url === href));
    if (match) return match;
    if (!res.pagination?.has_more) break;
  }
  return null;
}
