import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BookmarkCard } from "./BookmarkCard";
import type { UIBookmark } from "@/hooks/use-bookmarks";
import type { ComponentProps, ReactElement } from "react";

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
    opened_count: 0,
    last_opened_at: null,
    notes: null,
    ...overrides,
  };
}

const noop = () => {};
type BookmarkCardProps = ComponentProps<typeof BookmarkCard>;
type StatusCallback = NonNullable<BookmarkCardProps["onPin"]>;
const noopStatus: StatusCallback = () => {};

function renderCard(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BookmarkCard — rendering", () => {
  it("renders the title", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("renders the domain", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders tags as badges", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("testing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open #typescript tag" })).toHaveAttribute(
      "href",
      "/tags/typescript"
    );
  });

  it("renders pipeline badge with correct status", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark({ status: "fetched" })} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByTestId("pipeline-badge")).toHaveTextContent("fetched");
  });

  it("labels the menu action as Mark unread when read_at is set", async () => {
    const user = userEvent.setup();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: "2024-01-16T00:00:00Z" })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={noopStatus}
        onMarkUnread={noopStatus}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    expect(screen.getByRole("menuitem", { name: "Mark unread" })).toBeInTheDocument();
  });

  it("labels the menu action as Mark read when read_at is null", async () => {
    const user = userEvent.setup();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: null })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={noopStatus}
        onMarkUnread={noopStatus}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    expect(screen.getByRole("menuitem", { name: "Mark read" })).toBeInTheDocument();
  });

  it("shows a Read Later badge when read_later is set", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark({ read_later: 1 })} onDelete={noop} onClick={noop} />
    );
    expect(screen.getByText("Read Later")).toBeInTheDocument();
  });
});

describe("BookmarkCard — actions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onClick with the bookmark when the card is clicked", async () => {
    const onClick = vi.fn();
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={onClick} />
    );
    // Click the card body (h3 title area)
    fireEvent.click(screen.getByText("Test Article").closest("[class*='rounded-lg']")!);
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "bm-1" }));
  });

  it("calls onPin when pin button is clicked and bookmark is not pinned", async () => {
    const onPin = vi.fn();
    renderCard(
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

  it("keeps bookmark actions discoverable without relying on hover", () => {
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark()}
        onDelete={noop}
        onClick={noop}
        onPin={noopStatus}
        onUnpin={noopStatus}
      />
    );

    expect(screen.getByRole("button", { name: "More bookmark actions" })).toBeVisible();
  });

  it("keeps the compact list row's trash action keyboard-accessible", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} compact />
    );

    expect(screen.getByRole("button", { name: "Move bookmark to trash" })).toBeVisible();
  });

  it("calls onUnpin when pin button is clicked and bookmark is already pinned", async () => {
    const onUnpin = vi.fn();
    renderCard(
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

  it("calls onArchive from the overflow menu", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark()}
        onDelete={noop}
        onClick={noop}
        onArchive={onArchive}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("keeps secondary bookmark actions in an explicit overflow menu", async () => {
    const user = userEvent.setup();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark()}
        onDelete={noop}
        onClick={noop}
        onArchive={noopStatus}
        onMarkRead={noopStatus}
        onReadLater={noopStatus}
      />
    );

    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));

    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Mark read" })).toBeInTheDocument();
  });

  it("calls onMarkRead from the menu when bookmark is unread", async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: null })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={onMarkRead}
        onMarkUnread={noopStatus}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Mark read" }));
    expect(onMarkRead).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onMarkUnread from the menu when bookmark is read", async () => {
    const user = userEvent.setup();
    const onMarkUnread = vi.fn();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark({ read_at: "2024-01-16T00:00:00Z" })}
        onDelete={noop}
        onClick={noop}
        onMarkRead={noopStatus}
        onMarkUnread={onMarkUnread}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Mark unread" }));
    expect(onMarkUnread).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onReadLater from the menu when bookmark is not marked", async () => {
    const user = userEvent.setup();
    const onReadLater = vi.fn();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark({ read_later: 0 })}
        onDelete={noop}
        onClick={noop}
        onReadLater={onReadLater}
        onClearReadLater={noopStatus}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Mark read later" }));
    expect(onReadLater).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("calls onClearReadLater from the menu when bookmark is already marked", async () => {
    const user = userEvent.setup();
    const onClearReadLater = vi.fn();
    renderCard(
      <BookmarkCard
        bookmark={makeBookmark({ read_later: 1 })}
        onDelete={noop}
        onClick={noop}
        onReadLater={noopStatus}
        onClearReadLater={onClearReadLater}
      />
    );
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Clear read later" }));
    expect(onClearReadLater).toHaveBeenCalledWith("bm-1", expect.any(Object));
  });

  it("tracks external opens and opens the bookmark in a new tab", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "bm-1", opened_count: 1, last_opened_at: "2024-01-16T10:00:00Z" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderCard(<BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />);
    fireEvent.click(screen.getByTitle("Open bookmark"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/article",
      "_blank",
      "noopener,noreferrer"
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://127.0.0.1:3210/bookmarks/bm-1/open",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(await screen.findByText(/opened 1x/)).toBeInTheDocument();
  });

  it("does not track copy-url actions as opens", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn() },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "bm-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    renderCard(<BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} />);
    await user.click(screen.getByRole("button", { name: "More bookmark actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy URL" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("BookmarkCard — compact mode", () => {
  it("renders title in compact layout", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} compact />
    );
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("renders domain in compact layout", () => {
    renderCard(
      <BookmarkCard bookmark={makeBookmark()} onDelete={noop} onClick={noop} compact />
    );
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });
});

describe("BookmarkCard — selection mode", () => {
  it("calls onToggleSelect when card is clicked in selection mode", () => {
    const onToggleSelect = vi.fn();
    renderCard(
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
    renderCard(<BookmarkCard bookmark={bookmark} onDelete={noop} onClick={noop} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
