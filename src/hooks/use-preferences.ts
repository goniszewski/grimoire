import { useState, useCallback } from "react";

export type ViewMode = "grid" | "list";

interface Preferences {
  showButtonLabels: boolean;
  viewMode: ViewMode;
}

const PREFS_KEY = "little-imp-preferences";

const defaults: Preferences = {
  showButtonLabels: true,
  viewMode: "grid",
};

function loadPrefs(): Preferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
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
