import { useCallback, useEffect, useState } from "react";

export type Appearance = "system" | "light" | "dark";
export type BookmarkClick = "details" | "external";
const KEY = "grimoire-browser-preferences";
let fallback: { appearance: Appearance; bookmarkClick: BookmarkClick } = { appearance: "system", bookmarkClick: "details" };
let storageUnavailable = false;
const EVENT = "grimoire-browser-preferences-changed";

function readPreferences(): { appearance: Appearance; bookmarkClick: BookmarkClick } {
  if (storageUnavailable) return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      appearance: saved?.appearance === "light" || saved?.appearance === "dark" ? saved.appearance : "system",
      bookmarkClick: saved?.bookmarkClick === "external" ? "external" : "details",
    };
  } catch {
    return fallback;
  }
}

export function useBrowserPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    const sync = () => setPreferences(readPreferences());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((partial: Partial<ReturnType<typeof readPreferences>>) => {
    const next = { ...readPreferences(), ...partial };
    fallback = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      storageUnavailable = false;
      window.dispatchEvent(new Event(EVENT));
    } catch {
      storageUnavailable = true;
      // Preferences remain usable when browser storage is unavailable.
      window.dispatchEvent(new Event(EVENT));
    }
  }, []);
  return { ...preferences, update };
}

export function useAppearance(): void {
  const { appearance } = useBrowserPreferences();
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance === "dark" || (appearance === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
}
