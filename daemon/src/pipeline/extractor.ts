/**
 * Strategy-based content extractor.
 *
 * Inspects the URL to pick the best extraction strategy:
 *   - youtube.com / youtu.be → YouTube transcript extractor
 *   - github.com  → GitHub API extractor
 *   - stackoverflow.com / stackexchange.com → SE API extractor
 *   - everything else → Readability-style HTML extractor
 */

import { FetchResult } from "./fetcher.js";
import { extractWithReadability } from "./extractors/readability.js";
import { extractFromGitHub, parseGitHubUrl } from "./extractors/github.js";
import { extractFromStackOverflow, parseSOUrl } from "./extractors/stackoverflow.js";
import { extractFromPdf } from "./extractors/pdf.js";
import { extractFromYouTube, parseYouTubeUrl } from "./extractors/youtube.js";
import { ExtractionResult } from "./extractors/types.js";
import { log } from "../logger.js";

export type { ExtractionResult };

function isGitHub(url: string): boolean {
  return parseGitHubUrl(url) !== null;
}

function isPDF(url: string, contentType: string): boolean {
  if (contentType.includes("application/pdf")) return true;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

function isStackOverflow(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "stackoverflow.com" ||
      host.endsWith(".stackexchange.com") ||
      host === "askubuntu.com" ||
      host === "serverfault.com" ||
      host === "superuser.com"
    );
  } catch {
    return false;
  }
}

function isYouTube(url: string): boolean {
  return parseYouTubeUrl(url) !== null;
}

export async function extractContent(
  url: string,
  fetched: FetchResult,
  fallbackTitle?: string | null
): Promise<ExtractionResult> {
  // Strategy: YouTube
  if (isYouTube(url)) {
    log.info("Using YouTube extractor", { url });
    try {
      return await extractFromYouTube(url);
    } catch (err) {
      log.warn("YouTube extractor failed, falling back to readability", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy: PDF
  if (isPDF(url, fetched.contentType)) {
    log.info("Using PDF extractor", { url });
    if (!fetched.bytes || fetched.bytes.byteLength === 0) {
      throw new Error(`Expected PDF bytes for ${url} but received none (content-type: ${fetched.contentType})`);
    }
    return extractFromPdf(fetched.bytes, fallbackTitle ?? null);
  }

  // Strategy: GitHub
  if (isGitHub(url)) {
    log.info("Using GitHub extractor", { url });
    try {
      return await extractFromGitHub(url);
    } catch (err) {
      log.warn("GitHub extractor failed, falling back to readability", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy: StackOverflow / StackExchange
  if (isStackOverflow(url) && parseSOUrl(url) !== null) {
    log.info("Using StackOverflow extractor", { url });
    try {
      return await extractFromStackOverflow(url);
    } catch (err) {
      log.warn("StackOverflow extractor failed, falling back to readability", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Default: Readability
  log.info("Using readability extractor", { url });
  return extractWithReadability(fetched.html, fetched.html);
}
