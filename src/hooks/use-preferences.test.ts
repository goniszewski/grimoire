import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePreferences } from "./use-preferences";

const PREFS_KEY = "little-imp-preferences";

describe("usePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns default values when localStorage is empty", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.viewMode).toBe("list");
    expect(result.current.showButtonLabels).toBe(true);
  });

  it("loads saved preferences from localStorage", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ viewMode: "list", showButtonLabels: false }));
    const { result } = renderHook(() => usePreferences());
    expect(result.current.viewMode).toBe("list");
    expect(result.current.showButtonLabels).toBe(false);
  });

  it("merges partial stored prefs with defaults", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ viewMode: "list" }));
    const { result } = renderHook(() => usePreferences());
    expect(result.current.viewMode).toBe("list");
    expect(result.current.showButtonLabels).toBe(true); // default preserved
  });

  it("updatePreferences changes viewMode and persists to localStorage", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.updatePreferences({ viewMode: "list" });
    });
    expect(result.current.viewMode).toBe("list");
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY)!);
    expect(stored.viewMode).toBe("list");
  });

  it("updatePreferences changes showButtonLabels and persists", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.updatePreferences({ showButtonLabels: false });
    });
    expect(result.current.showButtonLabels).toBe(false);
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY)!);
    expect(stored.showButtonLabels).toBe(false);
  });

  it("partial update keeps other prefs unchanged", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.updatePreferences({ viewMode: "list" });
    });
    expect(result.current.showButtonLabels).toBe(true);
  });

  it("falls back to defaults if localStorage contains invalid JSON", () => {
    localStorage.setItem(PREFS_KEY, "not-json");
    const { result } = renderHook(() => usePreferences());
    expect(result.current.viewMode).toBe("list");
    expect(result.current.showButtonLabels).toBe(true);
  });
});
