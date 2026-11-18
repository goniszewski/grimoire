import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Tags from "./Tags";
import type { ApiTag, ApiTagRecord } from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";

vi.mock("@/lib/api", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import * as api from "@/lib/api";

const mockedListTags = api.listTags as unknown as ReturnType<typeof vi.fn>;
const mockedCreateTag = api.createTag as unknown as ReturnType<typeof vi.fn>;
const mockedDeleteTag = api.deleteTag as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateTag = api.updateTag as unknown as ReturnType<typeof vi.fn>;

function makeTag(overrides: Partial<ApiTag> = {}): ApiTag {
  return {
    id: "tag-1",
    name: "typescript",
    description: null,
    created_at: "2026-05-31T12:00:00Z",
    bookmark_count: 42,
    ...overrides,
  };
}

function makeTagRecord(overrides: Partial<ApiTagRecord> = {}): ApiTagRecord {
  return {
    id: "tag-1",
    name: "typescript",
    description: null,
    created_at: "2026-05-31T12:00:00Z",
    ...overrides,
  };
}

function renderTagsPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderResult = render(
    <MemoryRouter initialEntries={["/tags"]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/tags" element={<Tags />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

  return { ...renderResult, queryClient: qc };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListTags.mockResolvedValue({ data: [] });
  mockedCreateTag.mockResolvedValue({ data: makeTagRecord() });
  mockedDeleteTag.mockResolvedValue(undefined);
  mockedUpdateTag.mockResolvedValue({ data: makeTagRecord({ name: "react-query" }) });
});

describe("Tags page", () => {
  it("lists tags with active bookmark counts and detail links", async () => {
    mockedListTags.mockResolvedValue({
      data: [
        makeTag(),
        makeTag({ id: "tag-2", name: "react", bookmark_count: 12 }),
      ],
    });

    renderTagsPage();

    expect(await screen.findByRole("heading", { name: "Tags" })).toBeInTheDocument();
    expect(await screen.findByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("42 bookmarks")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("12 bookmarks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open #typescript tag" })).toHaveAttribute(
      "href",
      "/tags/typescript"
    );
  });

  it("creates a normalised tag from the management surface", async () => {
    renderTagsPage();

    fireEvent.change(await screen.findByLabelText("Tag name"), { target: { value: " TypeScript " } });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => expect(mockedCreateTag).toHaveBeenCalledWith("typescript", null));
  });

  it("confirms tag deletion before detaching it from bookmarks", async () => {
    mockedListTags.mockResolvedValue({ data: [makeTag({ bookmark_count: 3 })] });

    const { queryClient } = renderTagsPage();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(await screen.findByRole("button", { name: "Delete typescript tag" }));
    expect(screen.getByText("Delete #typescript?")).toBeInTheDocument();
    expect(screen.getByText(/This will remove the tag from 3 bookmarks in the active library/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));

    await waitFor(() => expect(mockedDeleteTag).toHaveBeenCalledWith("tag-1"));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.tags });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.archive });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.trash });
  });

  it("edits a tag from the management surface and refreshes cached bookmark views", async () => {
    mockedListTags
      .mockResolvedValueOnce({ data: [makeTag({ bookmark_count: 3 })] })
      .mockResolvedValue({ data: [makeTag({ name: "react-query", bookmark_count: 3 })] });

    const { queryClient } = renderTagsPage();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(await screen.findByRole("button", { name: "Edit typescript tag" }));
    expect(screen.getByText("Edit #typescript")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New tag name"), { target: { value: " React-Query " } });
    fireEvent.click(screen.getByRole("button", { name: "Save tag" }));

    await waitFor(() => expect(mockedUpdateTag).toHaveBeenCalledWith("tag-1", { name: "react-query", description: null }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.tags });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.archive });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.trash });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["search"] });
    expect(await screen.findByText("react-query")).toBeInTheDocument();
  });

  it("keeps the rename dialog open when the daemon rejects the target name", async () => {
    mockedListTags.mockResolvedValue({ data: [makeTag()] });
    mockedUpdateTag.mockRejectedValue(new Error("Tag already exists"));

    renderTagsPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit typescript tag" }));
    fireEvent.change(screen.getByLabelText("New tag name"), { target: { value: "react-query" } });
    fireEvent.click(screen.getByRole("button", { name: "Save tag" }));

    expect(await screen.findByText("Tag already exists")).toBeInTheDocument();
    expect(screen.getByText("Edit #typescript")).toBeInTheDocument();
  });

  it("shows tag descriptions as secondary text with a tooltip", async () => {
    mockedListTags.mockResolvedValue({
      data: [makeTag({ description: "Typed JavaScript notes" }), makeTag({ id: "tag-2", name: "plain" })],
    });

    renderTagsPage();

    const description = await screen.findByText("Typed JavaScript notes");
    expect(description).toHaveAttribute("title", "Typed JavaScript notes");
  });

  it("creates a tag with an optional description", async () => {
    renderTagsPage();

    fireEvent.change(await screen.findByLabelText("Tag name"), { target: { value: "rag" } });
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "  Retrieval notes " } });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => expect(mockedCreateTag).toHaveBeenCalledWith("rag", "Retrieval notes"));
  });

  it("edits only the description of an existing tag", async () => {
    mockedListTags.mockResolvedValue({ data: [makeTag({ description: "old" })] });

    renderTagsPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit typescript tag" }));
    const field = screen.getByLabelText("Tag description (optional)") as HTMLTextAreaElement;
    expect(field.value).toBe("old");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save tag" }));

    await waitFor(() =>
      expect(mockedUpdateTag).toHaveBeenCalledWith("tag-1", { name: "typescript", description: null })
    );
  });
});
