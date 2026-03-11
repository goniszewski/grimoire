/**
 * Generic Readability-style content extractor.
 *
 * Bun does not ship with a DOM parser that supports the full Readability API,
 * so we use a lightweight HTML-to-markdown approach:
 *   1. Strip boilerplate (nav, header, footer, aside, ads, cookie banners).
 *   2. Grab the largest text block as main content.
 *   3. Convert remaining HTML to plain Markdown.
 *
 * This is intentionally simple — the LLM enrichment stage (TASK-007) will
 * produce a cleaner summary on top of this raw content.
 */

import { ExtractionResult } from "./types.js";

// ─── Simple HTML helpers (no external deps) ──────────────────────────────────

/** Remove all instances of a tag (and its content) from an HTML string. */
function stripTags(html: string, ...tags: string[]): string {
  for (const tag of tags) {
    // Matches <tag ...>…</tag> including nested content (non-greedy)
    html = html.replace(
      new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "gi"),
      ""
    );
    // Also self-closing
    html = html.replace(new RegExp(`<${tag}[^>]*\\/?>`, "gi"), "");
  }
  return html;
}

/** Remove HTML tags and decode common entities, returning plain text. */
function stripAllTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Naively convert HTML block elements to Markdown-ish text. */
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${stripAllTags(t)}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${stripAllTags(t)}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${stripAllTags(t)}\n`)
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, (_, t) => `\n#### ${stripAllTags(t)}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${stripAllTags(t)}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${stripAllTags(t)}\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) =>
      `[${stripAllTags(text)}](${href})`
    )
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripAllTags(t)}**`)
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripAllTags(t)}*`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripAllTags(t)}\``)
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\`\`\`\n${stripAllTags(t)}\n\`\`\`\n`)
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Count words in plain text. */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Extract <meta name="…"> or <meta property="…"> content. */
function metaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const m = html.match(
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i"
      )
    ) ?? html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
        "i"
      )
    );
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/** Extract <title> text. */
function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripAllTags(m[1]) : null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function extractWithReadability(html: string, rawHtml: string): ExtractionResult {
  // 1. Strip boilerplate sections
  let cleaned = stripTags(
    html,
    "nav", "header", "footer", "aside",
    "script", "style", "noscript",
    "iframe", "svg", "canvas",
    // Cookie banner / ad common patterns — matched by class/id would need a DOM parser,
    // so we strip by tag family here; class-based stripping is best-effort via regex.
    "form"
  );

  // Strip common ad/cookie/nav divs by id/class patterns
  cleaned = cleaned.replace(
    /<[a-z][^>]*(?:id|class)=["'][^"']*(?:cookie|banner|popup|modal|sidebar|advertisement|ad-|social-share|related-posts|newsletter|subscribe)[^"']*["'][^>]*>[\s\S]*?<\/[a-z]+>/gi,
    ""
  );

  // 2. Find the largest <article> or <main> block, fall back to <body>
  const articleMatch =
    cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
    cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ??
    cleaned.match(/<div[^>]*(?:id|class)=["'][^"']*(?:content|article|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ??
    cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  const mainBlock = articleMatch?.[1] ?? cleaned;

  // 3. Convert to Markdown
  const markdown = htmlToMarkdown(mainBlock);

  // 4. Metadata
  const title =
    metaContent(html, "og:title", "twitter:title") ?? extractTitle(html) ?? null;
  const author =
    metaContent(html, "author", "article:author", "og:author") ?? null;
  const publishedAt =
    metaContent(html, "article:published_time", "og:article:published_time", "date") ??
    null;
  const lang = html.match(/\blang=["']([a-z]{2,})/i)?.[1] ?? null;

  return {
    title,
    markdown,
    rawHtml,
    author,
    publishedAt,
    wordCount: countWords(markdown),
    language: lang,
  };
}
