import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Combobox, ComboboxItem } from "./combobox";

const items: ComboboxItem[] = [
  { value: "openai/gpt-5.2", label: "OpenAI: GPT-5.2", hint: "400k context" },
  { value: "google/gemini-3.5-flash-lite", label: "Google: Gemini 3.5 Flash Lite" },
  { value: "deepseek/deepseek-v4-flash", label: "DeepSeek: DeepSeek V4 Flash" },
];

function renderCombobox(overrides: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  const onValueChange = vi.fn();
  const utils = render(
    <Combobox
      value=""
      onValueChange={onValueChange}
      items={items}
      ariaLabel="Model"
      {...overrides}
    />
  );
  return { onValueChange, ...utils };
}

function openCombobox() {
  fireEvent.click(screen.getByRole("combobox", { name: "Model" }));
}

describe("Combobox", () => {
  it("matches the trigger by accessible name and shows the selected label", () => {
    const { rerender } = render(
      <Combobox
        value="openai/gpt-5.2"
        onValueChange={() => {}}
        items={items}
        ariaLabel="Model"
      />
    );
    expect(screen.getByRole("combobox", { name: "Model" })).toBeInTheDocument();
    expect(screen.getByText("OpenAI: GPT-5.2")).toBeInTheDocument();
    rerender(
      <Combobox
        value="custom/unknown-slug"
        onValueChange={() => {}}
        items={items}
        ariaLabel="Model"
      />
    );
    expect(screen.getByText("custom/unknown-slug")).toBeInTheDocument();
  });

  it("filters items by label or value when typing", () => {
    renderCombobox();
    openCombobox();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "gemini" },
    });
    expect(screen.getByText("Google: Gemini 3.5 Flash Lite")).toBeInTheDocument();
    expect(screen.queryByText("OpenAI: GPT-5.2")).not.toBeInTheDocument();
  });

  it("matches items when the query has surrounding whitespace", () => {
    renderCombobox();
    openCombobox();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "  gpt-5.2  " },
    });
    expect(screen.getByText("OpenAI: GPT-5.2")).toBeInTheDocument();
    expect(screen.queryByText(/Use/)).not.toBeInTheDocument();
  });

  it("selects an item and reports the value", () => {
    const { onValueChange } = renderCombobox();
    openCombobox();
    fireEvent.click(screen.getByRole("option", { name: /Google: Gemini 3.5 Flash Lite/ }));
    expect(onValueChange).toHaveBeenCalledWith("google/gemini-3.5-flash-lite");
  });

  it("offers a custom entry for values not in the list when allowCustom is set", () => {
    const { onValueChange } = renderCombobox({ allowCustom: true });
    openCombobox();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "my/custom-model" },
    });
    fireEvent.click(screen.getByRole("option", { name: /my\/custom-model/ }));
    expect(onValueChange).toHaveBeenCalledWith("my/custom-model");
  });

  it("shows an empty state when nothing matches and no custom entry is allowed", () => {
    renderCombobox({ allowCustom: false, emptyText: "No matching models" });
    openCombobox();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "zzz-nothing" },
    });
    expect(screen.getByText("No matching models")).toBeInTheDocument();
  });

  it("shows a loading message while items are empty and loading", () => {
    renderCombobox({ items: [], loading: true });
    openCombobox();
    expect(screen.getByText("Loading models…")).toBeInTheDocument();
  });

  it("shows the error with a retry action and keeps custom entry available", () => {
    const onRetry = vi.fn();
    const { onValueChange } = renderCombobox({
      error: "HTTP 502",
      onRetry,
      allowCustom: true,
    });
    openCombobox();
    expect(screen.getByText("HTTP 502")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("renders the hint next to matching items", async () => {
    renderCombobox();
    openCombobox();
    await waitFor(() => expect(screen.getByText("400k context")).toBeInTheDocument());
  });
});
