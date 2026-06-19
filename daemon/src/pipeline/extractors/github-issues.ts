/**
 * GitHub issue extractor.
 *
 * Uses the GitHub REST API to fetch issue metadata and the first page of
 * comments. Token is optional; unauthenticated requests are rate-limited to
 * 60/hr. Set GITHUB_TOKEN to raise the limit to 5,000/hr.
 */

import { ExtractionResult } from "./types.js";

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 15_000;
const DEFAULT_COMMENT_LIMIT = 10;

interface GhIssueLabel {
  name: string;
}

interface GhIssueUser {
  login: string;
}

interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: GhIssueLabel[];
  created_at: string | null;
  updated_at: string | null;
  user: GhIssueUser | null;
  assignees: GhIssueUser[];
  comments: number;
}

interface GhIssueComment {
  user: GhIssueUser | null;
  created_at: string | null;
  body: string | null;
}

export interface GitHubIssueUrl {
  owner: string;
  repo: string;
  number: number;
}

async function ghIssueFetch(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "LittleImp/0.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 429 || res.headers.get("x-ratelimit-remaining") === "0") {
        throw new Error(
          `GitHub API rate limit exceeded for ${path}. Set GITHUB_TOKEN to increase the request limit.`
        );
      }
      throw new Error(`GitHub API ${res.status}: ${path}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function parseGitHubIssueUrl(url: string): GitHubIssueUrl | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "github.com") return null;

    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    if (parts.length < 4 || parts[2] !== "issues") return null;
    if (!/^\d+$/.test(parts[3])) return null;

    const number = Number.parseInt(parts[3], 10);
    if (number < 1) return null;

    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ""),
      number,
    };
  } catch {
    return null;
  }
}

function listOrNone(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function buildMarkdown(
  issue: GhIssue,
  parsed: GitHubIssueUrl,
  comments: GhIssueComment[]
): string {
  const labels = issue.labels.map((label) => label.name).filter(Boolean);
  const assignees = issue.assignees.map((assignee) => assignee.login).filter(Boolean);
  const author = issue.user?.login ?? "unknown";

  const commentSections = comments
    .filter((comment) => comment.body?.trim())
    .map((comment) => [
      `### ${comment.user?.login ?? "unknown"}${comment.created_at ? ` · ${comment.created_at}` : ""}`,
      "",
      comment.body!.trim(),
    ].join("\n"));

  return [
    `# ${issue.title}`,
    "",
    `**Repository:** ${parsed.owner}/${parsed.repo}`,
    `**Issue:** #${issue.number}`,
    `**State:** ${issue.state}`,
    `**Labels:** ${listOrNone(labels)}`,
    `**Author:** ${author}`,
    `**Assignees:** ${listOrNone(assignees)}`,
    ...(issue.updated_at ? [`**Updated:** ${issue.updated_at}`] : []),
    "",
    "## Issue Body",
    "",
    issue.body?.trim() || "_No issue body provided._",
    ...(commentSections.length > 0 ? ["", "## Top Comments", "", ...commentSections] : []),
  ].join("\n").trim();
}

export async function extractFromGitHubIssue(
  url: string,
  commentLimit = DEFAULT_COMMENT_LIMIT
): Promise<ExtractionResult> {
  const parsed = parseGitHubIssueUrl(url);
  if (!parsed) throw new Error(`Not a valid GitHub issue URL: ${url}`);

  const ownerEnc = encodeURIComponent(parsed.owner);
  const repoEnc = encodeURIComponent(parsed.repo);
  const issuePath = `/repos/${ownerEnc}/${repoEnc}/issues/${parsed.number}`;

  const issue = (await ghIssueFetch(issuePath)) as GhIssue;
  let comments: GhIssueComment[] = [];

  // Comments are supplemental: a transient failure here (rate-limit, network,
  // 404 on the comments endpoint) must not discard an otherwise successful
  // issue extraction. The enclosing extractor router only catches full extractor
  // failures and would fall back to readability HTML, losing the issue body.
  if (issue.comments > 0 && commentLimit > 0) {
    try {
      comments = (await ghIssueFetch(
        `${issuePath}/comments?per_page=${Math.min(commentLimit, 100)}`
      )) as GhIssueComment[];
    } catch {
      // Best-effort: continue with the issue body and metadata only.
      comments = [];
    }
  }

  const markdown = buildMarkdown(issue, parsed, comments);
  const tags = issue.labels.map((label) => label.name).filter(Boolean);

  return {
    title: issue.title,
    markdown,
    rawHtml: null,
    author: issue.user?.login ?? null,
    publishedAt: issue.created_at,
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    language: null,
    tags,
  };
}
