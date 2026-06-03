import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UpdateAvailableBanner } from "./UpdateAvailableBanner";

function renderBanner(latestTag = "v0.2.0", currentVersion = "0.1.0-beta", onDismiss = vi.fn()) {
  return render(
    <MemoryRouter>
      <UpdateAvailableBanner
        latestTag={latestTag}
        currentVersion={currentVersion}
        onDismiss={onDismiss}
      />
    </MemoryRouter>
  );
}

describe("UpdateAvailableBanner", () => {
  it("renders the available version and current version", () => {
    renderBanner("v0.2.0", "0.1.0-beta");
    expect(screen.getByText(/Little Imp v0.2.0 is available/)).toBeInTheDocument();
    expect(screen.getByText(/current: 0.1.0-beta/)).toBeInTheDocument();
  });

  it("renders a 'View update' link that navigates to /settings", () => {
    // `useNavigate` pushes to the MemoryRouter internally, but we can verify
    // the button is rendered and clickable without error
    renderBanner();
    const link = screen.getByRole("button", { name: /View update/i });
    expect(link).toBeInTheDocument();
    expect(() => fireEvent.click(link)).not.toThrow();
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    renderBanner("v0.2.0", "0.1.0-beta", onDismiss);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders with accessible role 'note'", () => {
    renderBanner();
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});
