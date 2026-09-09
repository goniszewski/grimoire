import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppearance, useBrowserPreferences } from "./use-browser-preferences";

describe("browser preferences", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it("defaults to system and details, rejects invalid stored values", () => {
    localStorage.setItem("grimoire-browser-preferences", '{"appearance":"invalid","bookmarkClick":true}');
    const { result } = renderHook(useBrowserPreferences);
    expect(result.current.appearance).toBe("system");
    expect(result.current.bookmarkClick).toBe("details");
  });
  it("synchronizes independent consumers and preserves both preferences", () => {
    const first = renderHook(useBrowserPreferences);
    const second = renderHook(useBrowserPreferences);
    act(() => first.result.current.update({ appearance: "dark" }));
    act(() => second.result.current.update({ bookmarkClick: "external" }));
    expect(first.result.current.bookmarkClick).toBe("external");
    expect(second.result.current.appearance).toBe("dark");
    first.unmount();
    expect(renderHook(useBrowserPreferences).result.current.appearance).toBe("dark");
  });
  it("tracks live system changes but preserves an explicit override", () => {
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    const prefs = renderHook(useBrowserPreferences);
    const appearance = renderHook(useAppearance);
    expect(document.documentElement).toHaveClass("dark");
    act(() => { media.matches = false; media.addEventListener.mock.calls[0][1](); });
    expect(document.documentElement).not.toHaveClass("dark");
    act(() => prefs.result.current.update({ appearance: "dark" }));
    expect(document.documentElement).toHaveClass("dark");
    appearance.unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  });
  it("remains synchronized when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const first = renderHook(useBrowserPreferences);
    const second = renderHook(useBrowserPreferences);
    act(() => first.result.current.update({ appearance: "light" }));
    expect(second.result.current.appearance).toBe("light");
  });
});
