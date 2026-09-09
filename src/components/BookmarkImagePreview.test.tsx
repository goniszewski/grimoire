import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookmarkImagePreview } from "./BookmarkImagePreview";
describe("full image preview", () => {
  it("opens by keyboard and returns focus after Escape", async () => {
    const user = userEvent.setup();
    render(<BookmarkImagePreview url="/image.png" alt="Portrait reference" onError={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Enlarge image: Portrait reference" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Image preview" })).toBeVisible();
    expect(screen.getAllByAltText("Portrait reference")).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("reports an unavailable enlarged image", async () => {
    render(<BookmarkImagePreview url="/image.png" alt="Reference" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.error(screen.getAllByAltText("Reference")[1]);
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });
});
