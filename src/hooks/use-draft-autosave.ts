import { useEffect } from "react";
import { clearDraft, saveDraft } from "@/lib/draft-storage";

export const DRAFT_AUTOSAVE_DELAY_MS = 400;

/**
 * Debounce-saves `value` to localStorage under `key` while `active`.
 * An empty value removes the draft instead of storing it.
 */
export function useDraftAutosave<T>(
  key: string | null,
  value: T,
  options: { active: boolean; isEmpty: (value: T) => boolean; delayMs?: number },
): void {
  const { active, isEmpty, delayMs = DRAFT_AUTOSAVE_DELAY_MS } = options;
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!active || key === null) return;
    const timer = window.setTimeout(() => {
      if (isEmpty(value)) clearDraft(key);
      else saveDraft(key, value);
    }, delayMs);
    return () => window.clearTimeout(timer);
    // `serialized` stands in for `value` so equal-by-content objects do not re-arm the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, serialized, delayMs]);
}
