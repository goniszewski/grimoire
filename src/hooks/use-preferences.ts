import { useState, useCallback } from "react";

export type ViewMode = "grid" | "list" | "gallery";

interface Preferences {
  showButtonLabels: boolean;
  viewMode: ViewMode;
  /** Gallery view only: hide bookmarks that have no cached image or screenshot. */
  galleryImagesOnly: boolean;
}

export const VIEW_MODES: readonly ViewMode[] = ["grid", "list", "gallery"];

const PREFS_KEY = "little-imp-preferences";

const defaults: Preferences = {
  showButtonLabels: true,
  viewMode: "list",
  galleryImagesOnly: false,
};

function loadPrefs(): Preferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const parsed = { ...defaults, ...JSON.parse(stored) } as Preferences;
      if (!VIEW_MODES.includes(parsed.viewMode)) parsed.viewMode = defaults.viewMode;
      return parsed;
    }
  } catch {
    // Use defaults when persisted preferences cannot be read.
  }
  return defaults;
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPrefs);

  const update = useCallback((partial: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { ...prefs, updatePreferences: update };
}
