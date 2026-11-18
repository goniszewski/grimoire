/**
 * Browser-local storage for unsaved form drafts (add/edit bookmark).
 *
 * Drafts never leave the browser: no API calls, not part of backups. Every
 * access is wrapped because localStorage can throw or be unavailable
 * (private windows, blocked site data, quota exceeded).
 */

const DRAFT_PREFIX = "grimoire:draft:v1:";
/** Drafts may hold private notes; stale ones are dropped on read instead of lingering forever. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  savedAt: number;
  data: T;
}

export const newBookmarkDraftKey = "new";
export const editDraftKey = (bookmarkId: string, field: string): string => `edit:${bookmarkId}:${field}`;

export function saveDraft<T>(key: string, data: T): boolean {
  try {
    const envelope: DraftEnvelope<T> = { savedAt: Date.now(), data };
    window.localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Returns the stored draft, or null when absent, malformed, or storage fails. */
export function loadDraft<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("data" in parsed)) return null;
    const savedAt = (parsed as { savedAt?: unknown }).savedAt;
    if (typeof savedAt !== "number" || Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    const data = (parsed as { data: unknown }).data;
    return isValid(data) ? data : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export interface NewBookmarkDraft {
  urls: string;
  title: string;
  notes: string;
  tags: string;
  readLater: boolean;
}

export function isNewBookmarkDraft(value: unknown): value is NewBookmarkDraft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.urls === "string" &&
    typeof v.title === "string" &&
    typeof v.notes === "string" &&
    typeof v.tags === "string" &&
    typeof v.readLater === "boolean"
  );
}

export function isNewBookmarkDraftEmpty(draft: NewBookmarkDraft): boolean {
  return !draft.urls.trim() && !draft.title.trim() && !draft.notes.trim() && !draft.tags.trim() && !draft.readLater;
}

export const isStringDraft = (value: unknown): value is string => typeof value === "string";
