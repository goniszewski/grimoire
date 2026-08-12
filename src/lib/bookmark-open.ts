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
