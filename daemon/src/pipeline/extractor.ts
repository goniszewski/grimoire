/**
 * Strategy-based content extractor.
 *
 * Inspects the URL to pick the best extraction strategy:
 *   - github.com  → GitHub API extractor
 *   - stackoverflow.com / stackexchange.com → SE API extractor
 *   - everything else → Readability-style HTML extractor
 */

import { FetchResult } from "./fetcher.js";
import { extractWithReadability } from "./extractors/readability.js";
import { extractFromGitHub, parseGitHubUrl } from "./extractors/github.js";
import { extractFromStackOverflow, parseSOUrl } from "./extractors/stackoverflow.js";
import { ExtractionResult } from "./extractors/types.js";
import { log } from "../logger.js";

export type { ExtractionResult };

function isGitHub(url: string): boolean {
  return parseGitHubUrl(url) !== null;
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

export async function extractContent(
  url: string,
  fetched: FetchResult
): Promise<ExtractionResult> {
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
