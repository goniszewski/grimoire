/**
 * Helpers for the Web Share Target (`/share?title=&text=&url=`).
 *
 * Android apps are inconsistent about which field carries the link: Chrome
 * sends the page URL in `url` on some versions and in `text` ("Title https://…")
 * on others. Accept either and keep only public http(s) links.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
// Trailing punctuation that is usually part of the sentence, not the URL.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

function asHttpUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim().replace(TRAILING_PUNCTUATION, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface SharedLink {
  url: string;
  title: string | undefined;
}

export function parseSharedLink(params: URLSearchParams): SharedLink | null {
  const url = asHttpUrl(params.get("url")) ?? asHttpUrl(URL_PATTERN.exec(params.get("text") ?? "")?.[0]);
  if (!url) return null;

  const title = params.get("title")?.trim();
  return { url, title: title || undefined };
}
