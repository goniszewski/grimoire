import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const themeMocks = vi.hoisted(() => ({
  resolvedTheme: "dark",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeMocks,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    themeMocks.resolvedTheme = "dark";
    themeMocks.setTheme.mockClear();
  });

  it("switches from dark to light with one click", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(themeMocks.setTheme).toHaveBeenCalledOnce();
    expect(themeMocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("switches from light to dark with one click", () => {
    themeMocks.resolvedTheme = "light";
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(themeMocks.setTheme).toHaveBeenCalledOnce();
    expect(themeMocks.setTheme).toHaveBeenCalledWith("dark");
  });
});
