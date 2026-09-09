import { recordBookmarkOpen } from "@/lib/api";
import { isSafeExternalBookmarkUrl } from "@/lib/safe-url";

export type OpenableBookmark = {
  id: string;
  url: string;
};

export type RecordedOpenMetrics = {
  id: string;
  opened_count: number;
  last_opened_at: string | null;
};

export function recordBookmarkOpenExternal(
  bookmark: OpenableBookmark,
  onRecorded?: (bookmark: RecordedOpenMetrics) => void
): void {
  void recordBookmarkOpen(bookmark.id)
    .then((response) => onRecorded?.(response.data))
    .catch(() => {
      // Opening the user's URL should not be blocked by local metrics failures.
    });
}

export function openBookmarkExternal(
  bookmark: OpenableBookmark,
  onRecorded?: (bookmark: RecordedOpenMetrics) => void
): boolean {
  if (!isSafeExternalBookmarkUrl(bookmark.url)) {
    return false;
  }
  window.open(bookmark.url, "_blank", "noopener,noreferrer");
  recordBookmarkOpenExternal(bookmark, onRecorded);
  return true;
}

export const MAX_OPEN_TABS = 10;

export function openSelectedBookmarks(bookmarks: OpenableBookmark[]): {
  opened: number; blockedIds: string[]; unsafeIds: string[];
} {
  const result = { opened: 0, blockedIds: [] as string[], unsafeIds: [] as string[] };
  if (bookmarks.length > MAX_OPEN_TABS) {
    return { ...result, blockedIds: bookmarks.map((bookmark) => bookmark.id) };
  }
  for (const bookmark of bookmarks) {
    if (!isSafeExternalBookmarkUrl(bookmark.url)) {
      result.unsafeIds.push(bookmark.id);
      continue;
    }
    // Open a same-origin blank tab first: noopener on window.open returns null
    // even for successful opens, making popup-block detection impossible.
    let tab: Window | null = null;
    try {
      tab = window.open("about:blank", "_blank");
      if (!tab) { result.blockedIds.push(bookmark.id); continue; }
      tab.opener = null;
      const link = tab.document.createElement("a");
      link.href = bookmark.url;
      link.rel = "noreferrer";
      link.referrerPolicy = "no-referrer";
      tab.document.body.appendChild(link);
      link.click();
      link.remove();
      result.opened++;
      recordBookmarkOpenExternal(bookmark);
    } catch {
      tab?.close();
      result.blockedIds.push(bookmark.id);
    }
  }
  return result;
}
