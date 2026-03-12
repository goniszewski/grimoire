/**
 * Netscape Bookmark File Format parser.
 *
 * Handles exports from Chrome, Firefox, Safari, and Edge.
 * The format is loosely defined HTML — parsers must be lenient.
 *
 * Structure:
 *   <H3>Folder</H3>
 *   <DL><p>
 *     <DT><A HREF="..." ADD_DATE="..." TAGS="...">Title</A>
 *     <DT><H3>Nested folder</H3>
 *     <DL><p>...</DL>
 *   </DL>
 */

import { isPrivateHost } from "../lib/network.js";

export interface ParsedBookmark {
  url: string;
  title: string;
  /** Unix timestamp (seconds) from ADD_DATE attribute, if present. */
  addDate: number | null;
  /** Raw comma-separated TAGS attribute value, if present. */
  tags: string[];
  /** Folder hierarchy from outermost → innermost (empty if not in a folder). */
  folders: string[];
}

export interface ParseResult {
  bookmarks: ParsedBookmark[];
  /** Parsing warnings (non-fatal). */
  warnings: string[];
}

// ─── Regex pattern sources ────────────────────────────────────────────────────
// Stored as strings so each matchAll call gets a fresh RegExp with its own lastIndex.

// Matches <A ...> tags (case-insensitive, multiline-safe)
const A_TAG_SRC = /<A\s([^>]*)>([\s\S]*?)<\/A>/gi.source;
// Matches <H3 ...>...</H3> — folder names
const H3_TAG_SRC = /<H3[^>]*>([\s\S]*?)<\/H3>/gi.source;
// Matches opening <DL> to track nesting depth changes
const DL_OPEN_SRC = /<DL[\s>]/gi.source;
// Matches closing </DL>
const DL_CLOSE_SRC = /<\/DL>/gi.source;

function attr(attrStr: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = re.exec(attrStr);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a Netscape bookmark HTML string.
 *
 * Strategy: single-pass token scan. We extract all tokens (H3, A, DL open/close)
 * in document order and maintain a folder stack to reconstruct hierarchy.
 */
export function parseNetscapeBookmarks(html: string): ParseResult {
  const bookmarks: ParsedBookmark[] = [];
  const warnings: string[] = [];

  // Build an ordered token list: { pos, type, raw }
  type TokenType = "h3" | "a" | "dl_open" | "dl_close";
  interface Token {
    pos: number;
    type: TokenType;
    raw: string;
    // for h3: folder name
    folderName?: string;
    // for a: parsed data
    href?: string;
    title?: string;
    addDate?: string | undefined;
    tags?: string | undefined;
  }

  const tokens: Token[] = [];

  for (const m of html.matchAll(new RegExp(A_TAG_SRC, "gi"))) {
    tokens.push({
      pos: m.index ?? 0,
      type: "a",
      raw: m[0],
      href: attr(m[1], "HREF") ?? undefined,
      title: decodeHtmlEntities(stripTags(m[2])),
      addDate: attr(m[1], "ADD_DATE") ?? undefined,
      tags: attr(m[1], "TAGS") ?? undefined,
    });
  }

  for (const m of html.matchAll(new RegExp(H3_TAG_SRC, "gi"))) {
    tokens.push({
      pos: m.index ?? 0,
      type: "h3",
      raw: m[0],
      folderName: decodeHtmlEntities(stripTags(m[1])),
    });
  }

  for (const m of html.matchAll(new RegExp(DL_OPEN_SRC, "gi"))) {
    tokens.push({ pos: m.index ?? 0, type: "dl_open", raw: m[0] });
  }

  for (const m of html.matchAll(new RegExp(DL_CLOSE_SRC, "gi"))) {
    tokens.push({ pos: m.index ?? 0, type: "dl_close", raw: m[0] });
  }

  // Sort by document position
  tokens.sort((a, b) => a.pos - b.pos);

  // Walk tokens maintaining a folder stack
  const folderStack: string[] = [];
  // Pending H3 seen before a DL_OPEN — will become a folder level
  let pendingFolder: string | null = null;

  for (const tok of tokens) {
    switch (tok.type) {
      case "h3":
        // H3 before its DL means it's a folder header
        pendingFolder = tok.folderName ?? null;
        break;

      case "dl_open":
        if (pendingFolder !== null) {
          folderStack.push(pendingFolder);
          pendingFolder = null;
        }
        break;

      case "dl_close":
        if (folderStack.length > 0) folderStack.pop();
        pendingFolder = null;
        break;

      case "a": {
        const href = tok.href;
        if (!href) {
          warnings.push(`Skipped <A> with no HREF near position ${tok.pos}`);
          break;
        }

        // Validate URL: must be http/https and must not point to a private/loopback host
        let valid = false;
        let skipReason = "";
        try {
          const u = new URL(href);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            skipReason = `Skipped non-http(s) URL: ${href.slice(0, 80)}`;
          } else if (isPrivateHost(u.hostname)) {
            // Reject private/loopback URLs to prevent SSRF via batch import
            skipReason = `Skipped private/internal URL: ${href.slice(0, 80)}`;
          } else {
            valid = true;
          }
        } catch {
          skipReason = `Skipped malformed URL near position ${tok.pos}`;
        }

        if (!valid) {
          warnings.push(skipReason);
          break;
        }

        const addDate = tok.addDate ? parseInt(tok.addDate, 10) : null;
        const rawTags = tok.tags ?? undefined;
        const tagList = rawTags
          ? rawTags
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
          : [];

        bookmarks.push({
          url: href,
          title: tok.title || href,
          addDate: addDate && !isNaN(addDate) ? addDate : null,
          tags: tagList,
          folders: [...folderStack],
        });
        break;
      }
    }
  }

  return { bookmarks, warnings };
}
