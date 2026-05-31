import { DAEMON_URL, type ApiBookmarkMediaItem, type ApiBookmarkMediaSet } from "./api";

export function normaliseDaemonMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return `${DAEMON_URL}${value}`;
  if (value.startsWith("data:image/")) return value;

  try {
    const parsed = new URL(value);
    if (parsed.origin === new URL(DAEMON_URL).origin) return value;
  } catch {
    return null;
  }

  return null;
}

export function generatedFavicon(domain: string): string {
  const label = (domain.replace(/^www\./, "").match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();
  const hue = Math.abs([...domain].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="hsl(${hue} 48% 34%)"/><text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normaliseMediaItem(item: ApiBookmarkMediaItem): ApiBookmarkMediaItem | null {
  const url = normaliseDaemonMediaUrl(item.url);
  if (!url) return null;
  return { ...item, url };
}

export function normaliseBookmarkMediaSet(
  media: ApiBookmarkMediaSet | null | undefined
): ApiBookmarkMediaSet | undefined {
  if (!media) return undefined;

  return {
    favicon: media.favicon ? normaliseMediaItem(media.favicon) : null,
    screenshot: media.screenshot ? normaliseMediaItem(media.screenshot) : null,
    images: media.images.map(normaliseMediaItem).filter((item): item is ApiBookmarkMediaItem => item !== null),
  };
}
