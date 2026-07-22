/**
 * Safe external URL helpers for rendering and opening bookmarks.
 */

export function isSafeExternalBookmarkUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function assertSafeExternalBookmarkUrl(raw: string): string {
  if (!isSafeExternalBookmarkUrl(raw)) {
    throw new Error("URL must be http(s) without embedded credentials");
  }
  return raw.trim();
}
