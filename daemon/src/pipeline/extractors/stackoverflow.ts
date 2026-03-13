/**
 * StackOverflow / StackExchange question extractor.
 *
 * Uses the Stack Exchange API v2.3 to fetch:
 *   - Question title, body, tags, vote score
 *   - The accepted answer (or highest-voted answer if none accepted)
 *
 * No API key required for read-only access (300 req/day unauthenticated).
 * Set STACKEXCHANGE_KEY env var for higher quota.
 */

import { ExtractionResult } from "./types.js";

const SE_API = "https://api.stackexchange.com/2.3";
const TIMEOUT_MS = 15_000;

interface SEAnswer {
  answer_id: number;
  is_accepted: boolean;
  score: number;
  body: string; // HTML
  owner: { display_name: string };
}

interface SEQuestion {
  question_id: number;
  title: string;
  body: string; // HTML
  tags: string[];
  score: number;
  creation_date: number; // Unix timestamp
  answers?: SEAnswer[];
  owner: { display_name: string };
}

interface SEResponse<T> {
  items: T[];
}

async function seFetch(path: string, site: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const key = process.env.STACKEXCHANGE_KEY;
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";
  const siteParam = `site=${encodeURIComponent(site)}`;

  try {
    const res = await fetch(
      `${SE_API}${path}${path.includes("?") ? "&" : "?"}${siteParam}${keyParam}`,
      {
        headers: { "User-Agent": "LittleImp/0.0" },
        signal: controller.signal,
      }
    );
    if (!res.ok) throw new Error(`SE API ${res.status}: ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Derive the SE API `site` parameter from a StackExchange URL.
 * stackoverflow.com → "stackoverflow"
 * askubuntu.com     → "askubuntu"
 * foo.stackexchange.com → "foo"
 * meta.stackexchange.com → "meta.stackexchange"
 */
function siteFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "stackoverflow.com" || host === "www.stackoverflow.com") return "stackoverflow";
    if (host === "askubuntu.com") return "askubuntu";
    if (host === "serverfault.com") return "serverfault";
    if (host === "superuser.com") return "superuser";
    // meta.stackexchange.com or foo.stackexchange.com
    const m = host.match(/^([^.]+)\.stackexchange\.com$/);
    if (m) return m[1] === "meta" ? "meta.stackexchange" : m[1];
  } catch {
    // fall through
  }
  return "stackoverflow";
}

/** Strip HTML tags for plain-text conversion. */
function stripHtml(html: string): string {
  return html
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) =>
      `\`\`\`\n${code.replace(/<[^>]+>/g, "")}\n\`\`\``
    )
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c}\``)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) =>
      t
        .split("\n")
        .map((l: string) => `> ${l}`)
        .join("\n")
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse a question ID from a StackOverflow URL. */
export function parseSOUrl(url: string): number | null {
  try {
    const m = url.match(/\/questions\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

export async function extractFromStackOverflow(url: string): Promise<ExtractionResult> {
  const questionId = parseSOUrl(url);
  if (!questionId) throw new Error(`Not a valid StackOverflow question URL: ${url}`);

  const site = siteFromUrl(url);

  const data = (await seFetch(
    `/questions/${questionId}?filter=withbody&order=desc&sort=votes`,
    site
  )) as SEResponse<SEQuestion>;

  const question = data.items[0];
  if (!question) throw new Error(`Question ${questionId} not found`);

  // Fetch answers separately with body filter
  const answersData = (await seFetch(
    `/questions/${questionId}/answers?filter=withbody&order=desc&sort=votes&pagesize=10`,
    site
  )) as SEResponse<SEAnswer>;

  const answers = answersData.items ?? [];
  const bestAnswer =
    answers.find((a) => a.is_accepted) ??
    answers.sort((a, b) => b.score - a.score)[0] ??
    null;

  const questionMd = stripHtml(question.body);
  const answerMd = bestAnswer ? stripHtml(bestAnswer.body) : null;

  const markdown = [
    `# ${question.title}`,
    "",
    `**Tags:** ${question.tags.join(", ")}  `,
    `**Score:** ${question.score}  `,
    `**Asked by:** ${question.owner.display_name}`,
    "",
    "## Question",
    "",
    questionMd,
    ...(answerMd
      ? [
          "",
          `## ${bestAnswer!.is_accepted ? "Accepted" : "Top"} Answer`,
          `*by ${bestAnswer!.owner.display_name} · score ${bestAnswer!.score}*`,
          "",
          answerMd,
        ]
      : []),
  ].join("\n");

  return {
    title: question.title,
    markdown,
    rawHtml: null,
    author: question.owner.display_name,
    publishedAt: new Date(question.creation_date * 1000).toISOString(),
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    language: null,
  };
}
