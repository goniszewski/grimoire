/**
 * GitHub repository extractor.
 *
 * Uses the GitHub REST API (no scraping) to fetch:
 *   - Repository metadata (name, description, language, topics, stars)
 *   - README content (rendered as Markdown via the contents API)
 *
 * Token is optional; unauthenticated requests are rate-limited to 60/hr.
 * Set GITHUB_TOKEN env var to raise the limit to 5 000/hr.
 */

import { ExtractionResult } from "./types.js";

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 15_000;

interface GhRepo {
  full_name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  pushed_at: string | null;
  owner: { login: string };
  default_branch: string;
}

interface GhContent {
  content: string; // base64
  encoding: string;
}

async function ghFetch(path: string): Promise<unknown> {
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
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Parse owner/repo from a github.com URL. */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export async function extractFromGitHub(url: string): Promise<ExtractionResult> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error(`Not a valid GitHub repo URL: ${url}`);

  const { owner, repo } = parsed;

  const ownerEnc = encodeURIComponent(owner);
  const repoEnc = encodeURIComponent(repo);

  const repoData = (await ghFetch(`/repos/${ownerEnc}/${repoEnc}`)) as GhRepo;

  let readme = "";
  try {
    const readmeData = (await ghFetch(
      `/repos/${ownerEnc}/${repoEnc}/readme`
    )) as GhContent;
    if (readmeData.encoding === "base64") {
      readme = Buffer.from(readmeData.content.replace(/\s/g, ""), "base64").toString(
        "utf-8"
      );
    }
  } catch {
    // README is optional — continue without it
  }

  const topicLine =
    repoData.topics.length > 0
      ? `**Topics:** ${repoData.topics.join(", ")}\n\n`
      : "";

  const markdown = [
    `# ${repoData.full_name}`,
    "",
    repoData.description ?? "",
    "",
    `**Language:** ${repoData.language ?? "unknown"}  `,
    `**Stars:** ${repoData.stargazers_count}  `,
    topicLine,
    readme,
  ]
    .join("\n")
    .trim();

  return {
    title: repoData.full_name,
    markdown,
    rawHtml: null,
    author: repoData.owner.login,
    publishedAt: repoData.pushed_at ?? null,
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    language: repoData.language?.toLowerCase() ?? null,
  };
}
