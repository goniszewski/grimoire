import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarkCard } from "./BookmarkCard";
import type { UIBookmark } from "@/hooks/use-bookmarks";
import type { ComponentProps } from "react";

// ─── Minimal mocks for deps that hit the DOM ──────────────────────────────────

vi.mock("./PipelineBadge", () => ({
  PipelineBadge: ({ initialStatus }: { initialStatus: string }) => (
    <span data-testid="pipeline-badge">{initialStatus}</span>
  ),
}));

vi.mock("./HighlightText", () => ({
  HighlightText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
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
type BookmarkCardProps = ComponentProps<typeof BookmarkCard>;
type StatusCallback = NonNullable<BookmarkCardProps["onPin"]>;
const noopStatus: StatusCallback = () => {};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BookmarkCard — rendering", () => {
  it("renders the title", () => {
    render(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("renders the domain", () => {
    render(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders tags as badges", () => {
    render(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("testing")).toBeInTheDocument();
  });

  it("renders pipeline badge with correct status", () => {
    render(
      <BookmarkCard bookmark={makeBookmark({ status: "fetched" })} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByTestId("pipeline-badge")).toHaveTextContent("fetched");
  });

  it("shows read indicator (BookOpen icon title) when read_at is set", () => {
    render(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: "2024-01-16T00:00:00Z" })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={noopStatus}
        onMarkUnread={noopStatus}
      />
    );
    // The "Mark unread" button appears when bookmark is already read
    const btn = screen.getByTitle("Mark unread");
    expect(btn).toBeInTheDocument();
  });

  it("shows 'Mark read' button when read_at is null", () => {
    render(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: null })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={noopStatus}
        onMarkUnread={noopStatus}
      />
    );
    expect(screen.getByTitle("Mark read")).toBeInTheDocument();
  });

  it("shows a Read Later badge when read_later is set", () => {
    render(
      <BookmarkCard bookmark={makeBookmark({ read_later: 1 })} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("Read Later")).toBeInTheDocument();
  });
});

describe("BookmarkCard — actions", () => {
  it("calls onClick with the bookmark when the card is clicked", async () => {
    const onClick = vi.fn();
    render(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={onClick} />
    );
    // Click the card body (h3 title area)
    fireEvent.click(screen.getByText("Test Article").closest("[class*='rounded-lg']")!);
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "bm-1" }));
  });

  it("calls onPin when pin button is clicked and bookmark is not pinned", async () => {
    const onPin = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark({ is_pinned: 0 })}
        onDelete={noop}
        onClick={noop}
        onPin={onPin}
        onUnpin={noopStatus}
      />
    );
    const pinBtn = screen.getByTitle("Pin");
    fireEvent.click(pinBtn);
    expect(onPin).toHaveBeenCalledWith("bm-1", expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it("calls onUnpin when pin button is clicked and bookmark is already pinned", async () => {
    const onUnpin = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark({ is_pinned: 1 })}
        onDelete={noop}
        onClick={noop}
        onPin={noopStatus}
        onUnpin={onUnpin}
      />
    );
    const unpinBtn = screen.getByTitle("Unpin");
    fireEvent.click(unpinBtn);
    expect(onUnpin).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onArchive when archive button is clicked", () => {
    const onArchive = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark()}
        onDelete={noop}
        onClick={noop}
        onArchive={onArchive}
      />
    );
    fireEvent.click(screen.getByTitle("Archive"));
    expect(onArchive).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onMarkRead when mark-read button clicked and bookmark is unread", () => {
    const onMarkRead = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: null })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={onMarkRead}
        onMarkUnread={noopStatus}
      />
    );
    fireEvent.click(screen.getByTitle("Mark read"));
    expect(onMarkRead).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onMarkUnread when mark-read button clicked and bookmark is read", () => {
    const onMarkUnread = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: "2024-01-16T00:00:00Z" })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={noopStatus}
        onMarkUnread={onMarkUnread}
      />
    );
    fireEvent.click(screen.getByTitle("Mark unread"));
    expect(onMarkUnread).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onReadLater when read-later button is clicked and bookmark is not marked", () => {
    const onReadLater = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark({ read_later: 0 })}
        onDelete={noop}
        onClick={noop}
        onReadLater={onReadLater}
        onClearReadLater={noopStatus}
      />
    );
    fireEvent.click(screen.getByTitle("Mark read later"));
    expect(onReadLater).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onClearReadLater when read-later button is clicked and bookmark is already marked", () => {
    const onClearReadLater = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark({ read_later: 1 })}
        onDelete={noop}
        onClick={noop}
        onReadLater={noopStatus}
        onClearReadLater={onClearReadLater}
      />
    );
    fireEvent.click(screen.getByTitle("Clear read later"));
    expect(onClearReadLater).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });
});

describe("BookmarkCard — compact mode", () => {
  it("renders title in compact layout", () => {
    render(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} compact />
    );
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("renders domain in compact layout", () => {
    render(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} compact />
    );
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });
});

describe("BookmarkCard — selection mode", () => {
  it("calls onToggleSelect when card is clicked in selection mode", () => {
    const onToggleSelect = vi.fn();
    render(
      <BookmarkCard
        bookmark={makeBookmark()}
        onDelete={noop}
        onClick={noop}
        selectionMode
        selected={false}
        onToggleSelect={onToggleSelect}
      />
    );
    fireEvent.click(screen.getByText("Test Article").closest("[class*='rounded-lg']")!);
    expect(onToggleSelect).toHaveBeenCalledWith("bm-1");
  });
});

describe("BookmarkCard — overflow tags", () => {
  it("shows +N badge when there are more than 4 tags", () => {
    const bookmark = makeBookmark({ tags: ["a", "b", "c", "d", "e", "f"] });
    render(<BookmarkCard bookmark={bookmark} onDelete={noop} onClick={noop} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
