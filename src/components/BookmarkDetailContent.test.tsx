import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarkDetailContent } from "./BookmarkDetailContent";
import type { UIBookmark } from "@/hooks/use-bookmarks";
import type { ComponentProps } from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./PipelineBadge", () => ({
  PipelineBadge: ({ initialStatus }: { initialStatus: string }) => (
    <span data-testid="pipeline-badge">{initialStatus}</span>
  ),
}));

vi.mock("./PipelineRecoveryPanel", () => ({
  PipelineRecoveryPanel: () => null,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// ─── Test data ────────────────────────────────────────────────────────────────

function makeBookmark(overrides: Partial<UIBookmark> = {}): UIBookmark {
  return {
    id: "bm-1",
    url: "https://example.com/article",
    title: "Test Article",
    rawTitle: "Test Article",
    summary: "A short summary of the article",
    domain: "example.com",
    favicon: "https://example.com/favicon.ico",
    tags: ["typescript", "testing"],
    category: "Tech",
    category_id: "cat-1",
    status: "ai_enriched",
    savedAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    is_pinned: 0,
    is_archived: 0,
    read_later: 0,
    read_at: null,
    notes: null,
    ...overrides,
  };
}

const noop = () => {};
type BookmarkDetailContentProps = ComponentProps<typeof BookmarkDetailContent>;
type DetailOverrides = Partial<Omit<BookmarkDetailContentProps, "bookmark">>;
type StatusCallback = NonNullable<BookmarkDetailContentProps["onPin"]>;
const noopStatus: StatusCallback = () => {};

function defaultProps(
  bm: UIBookmark,
  overrides: DetailOverrides = {}
): BookmarkDetailContentProps {
  return {
    bookmark: bm,
    onUpdateTags: vi.fn(),
    onUpdateCategory: vi.fn(),
    onUpdateField: vi.fn(),
    onUpdateNotes: vi.fn(),
    relatedBookmarks: [],
    onSelectRelated: vi.fn(),
    ...overrides,
  };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("BookmarkDetailContent — rendering", () => {
  it("renders the pipeline badge with the bookmark status", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark({ status: "indexed" }))} />);
    expect(screen.getByTestId("pipeline-badge")).toHaveTextContent("indexed");
  });

  it("renders the summary text", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark())} />);
    expect(screen.getByText("A short summary of the article")).toBeInTheDocument();
  });

  it("renders existing notes with Markdown", () => {
    const bm = makeBookmark({ notes: "**bold note**" });
    render(<BookmarkDetailContent {...defaultProps(bm)} />);
    expect(screen.getByTestId("markdown")).toHaveTextContent("**bold note**");
  });

  it("shows placeholder text when notes are null", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark({ notes: null }))} />);
    expect(screen.getByText(/add a personal note/i)).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark())} />);
    expect(screen.getByText(/typescript/)).toBeInTheDocument();
    expect(screen.getByText(/testing/)).toBeInTheDocument();
  });

  it("renders the category badge", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark())} />);
    expect(screen.getByText("Tech")).toBeInTheDocument();
  });

  it("renders the URL", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark())} />);
    expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
  });

  it("renders related bookmarks when provided", () => {
    const related = makeBookmark({ id: "bm-2", title: "Related Article" });
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark(), { relatedBookmarks: [related] })}
      />
    );
    expect(screen.getByText("Related Article")).toBeInTheDocument();
  });

  it("renders a Read Later badge when read_later is set", () => {
    render(<BookmarkDetailContent {...defaultProps(makeBookmark({ read_later: 1 }))} />);
    expect(screen.getByText("Read Later")).toBeInTheDocument();
  });
});

// ─── Notes editing ────────────────────────────────────────────────────────────

describe("BookmarkDetailContent — notes editing", () => {
  it("opens notes textarea when edit pencil button is clicked", async () => {
    const user = userEvent.setup();
    render(<BookmarkDetailContent {...defaultProps(makeBookmark({ notes: "existing note" }))} />);

    // The notes edit button (pencil in the Notes header)
    const editButtons = screen.getAllByRole("button");
    const pencilBtn = editButtons.find((b) => b.querySelector("svg"));
    // Click the pencil next to Notes header (first pencil button in the notes section)
    const notesSection = screen.getByText("Notes").closest("div")!.parentElement!;
    const pencil = notesSection.querySelector("button")!;
    await user.click(pencil);

    expect(screen.getByPlaceholderText(/add a personal note/i)).toBeInTheDocument();
  });

  it("calls onUpdateNotes with new content on confirm", async () => {
    const onUpdateNotes = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ notes: null }), { onUpdateNotes })}
      />
    );

    // Click placeholder to open edit mode
    await user.click(screen.getByText(/add a personal note/i));
    const textarea = screen.getByPlaceholderText(/add a personal note/i);
    await user.clear(textarea);
    await user.type(textarea, "my new note");

    // Confirm by pressing Enter shortcut or use keyboard — just blur/submit via keyboard
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    // The component saves on button click, not keydown. Submit via the confirm button.
    // After typing, the edit mode buttons appear. We click the first small icon button
    // within the notes editing area (the check button).
    // Find the textarea's parent container and locate the check button within it.
    const editContainer = textarea.closest("div[class*='space-y']")!;
    const [confirmBtn] = Array.from(editContainer.querySelectorAll("button"));
    fireEvent.click(confirmBtn);

    expect(onUpdateNotes).toHaveBeenCalledWith("bm-1", "my new note");
  });

  it("does not call onUpdateNotes if content is unchanged", async () => {
    const onUpdateNotes = vi.fn();
    const user = userEvent.setup();
    const bm = makeBookmark({ notes: "existing" });
    render(<BookmarkDetailContent {...defaultProps(bm, { onUpdateNotes })} />);

    // Open edit mode by clicking the markdown area
    await user.click(screen.getByTestId("markdown"));

    // Click confirm without changing the text
    const [confirmBtn] = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent && b.classList.toString().includes("h-6"));
    fireEvent.click(confirmBtn);

    expect(onUpdateNotes).not.toHaveBeenCalled();
  });

  it("closes edit mode without saving when cancel is clicked", async () => {
    const onUpdateNotes = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ notes: null }), { onUpdateNotes })}
      />
    );

    await user.click(screen.getByText(/add a personal note/i));
    const textarea = screen.getByPlaceholderText(/add a personal note/i);
    await user.type(textarea, "unsaved text");

    // Cancel (X) button — second button in the editing container
    const editContainer = textarea.closest("div[class*='space-y']")!;
    const [, cancelBtn] = Array.from(editContainer.querySelectorAll("button"));
    fireEvent.click(cancelBtn);

    expect(onUpdateNotes).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/add a personal note/i)).not.toBeInTheDocument();
  });
});

// ─── Title / summary inline edit ─────────────────────────────────────────────

describe("BookmarkDetailContent — summary editing", () => {
  it("calls onUpdateField with 'summary' when summary is edited and confirmed", async () => {
    const onUpdateField = vi.fn();
    const user = userEvent.setup();
    const bm = makeBookmark({ summary: "original summary" });
    render(<BookmarkDetailContent {...defaultProps(bm, { onUpdateField })} />);

    // Hover over summary section — pencil appears. Force-click via direct DOM manipulation.
    const summaryText = screen.getByText("original summary");
    const summaryRow = summaryText.closest("div[class*='flex']")!;
    const pencilBtn = summaryRow.querySelector("button")!;
    fireEvent.click(pencilBtn);

    const textarea = screen.getByDisplayValue("original summary");
    await user.clear(textarea);
    await user.type(textarea, "updated summary");

    // Confirm
    const confirmBtns = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent && b.classList.toString().includes("h-6"));
    fireEvent.click(confirmBtns[0]);

    expect(onUpdateField).toHaveBeenCalledWith("bm-1", "summary", "updated summary");
  });
});

// ─── Tag management ───────────────────────────────────────────────────────────

describe("BookmarkDetailContent — tags", () => {
  it("calls onUpdateTags when a tag is removed by clicking it", async () => {
    const onUpdateTags = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark(), { onUpdateTags })}
      />
    );

    // Tags show as "typescript ×" badges — click one to remove
    fireEvent.click(screen.getByText(/typescript/));

    expect(onUpdateTags).toHaveBeenCalledWith(
      "bm-1",
      expect.not.arrayContaining(["typescript"])
    );
  });

  it("calls onUpdateTags when Enter is pressed in the tag input", async () => {
    const onUpdateTags = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ tags: [] }), { onUpdateTags })}
      />
    );

    const tagInput = screen.getByPlaceholderText("add tag...");
    await user.type(tagInput, "newtag{Enter}");

    expect(onUpdateTags).toHaveBeenCalledWith("bm-1", ["newtag"]);
  });

  it("does not add a duplicate tag", async () => {
    const onUpdateTags = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ tags: ["typescript"] }), { onUpdateTags })}
      />
    );

    const tagInput = screen.getByPlaceholderText("add tag...");
    await user.type(tagInput, "typescript{Enter}");

    expect(onUpdateTags).not.toHaveBeenCalled();
  });
});

// ─── Action buttons ───────────────────────────────────────────────────────────

describe("BookmarkDetailContent — actions", () => {
  it("calls onPin when Pin button is clicked on an unpinned bookmark", () => {
    const onPin = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ is_pinned: 0 }), { onPin, onUnpin: noopStatus })}
      />
    );
    fireEvent.click(screen.getByText("Pin"));
    expect(onPin).toHaveBeenCalledWith("bm-1", expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it("calls onUnpin when Unpin button is clicked on a pinned bookmark", () => {
    const onUnpin = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ is_pinned: 1 }), { onPin: noopStatus, onUnpin })}
      />
    );
    fireEvent.click(screen.getByText("Unpin"));
    expect(onUnpin).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onArchive when Archive button is clicked", () => {
    const onArchive = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ is_archived: 0 }), { onArchive })}
      />
    );
    fireEvent.click(screen.getByText("Archive"));
    expect(onArchive).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("does not show Archive button when bookmark is already archived", () => {
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ is_archived: 1 }), { onArchive: vi.fn() })}
      />
    );
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
  });

  it("calls onMarkRead when 'Mark read' button is clicked on unread bookmark", () => {
    const onMarkRead = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ read_at: null }), { onMarkRead, onMarkUnread: noopStatus })}
      />
    );
    fireEvent.click(screen.getByText("Mark read"));
    expect(onMarkRead).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onMarkUnread when 'Mark unread' button is clicked on read bookmark", () => {
    const onMarkUnread = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ read_at: "2024-01-16T00:00:00Z" }), {
          onMarkRead: noopStatus,
          onMarkUnread,
        })}
      />
    );
    fireEvent.click(screen.getByText("Mark unread"));
    expect(onMarkUnread).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onReadLater when Read later button is clicked on an unmarked bookmark", () => {
    const onReadLater = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ read_later: 0 }), { onReadLater, onClearReadLater: noopStatus })}
      />
    );
    fireEvent.click(screen.getByText("Read later"));
    expect(onReadLater).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onClearReadLater when Clear read later button is clicked on a marked bookmark", () => {
    const onClearReadLater = vi.fn();
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark({ read_later: 1 }), { onReadLater: noopStatus, onClearReadLater })}
      />
    );
    fireEvent.click(screen.getByText("Clear read later"));
    expect(onClearReadLater).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onSelectRelated when a related bookmark is clicked", () => {
    const onSelectRelated = vi.fn();
    const related = makeBookmark({ id: "bm-rel", title: "Related" });
    render(
      <BookmarkDetailContent
        {...defaultProps(makeBookmark(), { relatedBookmarks: [related], onSelectRelated })}
      />
    );
    fireEvent.click(screen.getByText("Related"));
    expect(onSelectRelated).toHaveBeenCalledWith(expect.objectContaining({ id: "bm-rel" }));
  });
});
