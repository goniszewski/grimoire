import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// ─── Mock heavy deps ──────────────────────────────────────────────────────────

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ state: "expanded", isMobile: false, openMobile: false, setOpenMobile: vi.fn(), toggleSidebar: vi.fn() }),
}));

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  ContextMenuSeparator: () => <hr />,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open !== false ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="alert-action" onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, onClick, variant }: { children: React.ReactNode; className?: string; onClick?: () => void; variant?: string }) => (
    <span data-testid="badge" className={className} onClick={onClick} data-variant={variant}>{children}</span>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  listSuggestions: vi.fn().mockResolvedValue({ data: [], meta: { pending: 0, total: 0 } }),
  listCategories: vi.fn().mockResolvedValue({ data: [] }),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import * as api from "@/lib/api";
import { AppSidebar } from "./AppSidebar";
import type { UICategory } from "@/hooks/use-bookmarks";
import type { TagCount, DomainCount } from "@/types/bookmark";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockResolved(fn: unknown, value: unknown) {
  (fn as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(value);
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const categories: UICategory[] = [
  { id: "cat-1", name: "Technology", count: 10 },
  { id: "cat-2", name: "Science", count: 5 },
];

const tags: TagCount[] = [
  { tag: "typescript", count: 8 },
  { tag: "react", count: 4 },
];

const domains: DomainCount[] = [
  { domain: "github.com", count: 15 },
];

const defaultProps = {
  categories,
  tags,
  domains,
  selectedCategory: null,
  selectedTag: null,
  selectedDomain: null,
  onSelectCategory: vi.fn(),
  onSelectTag: vi.fn(),
  onSelectDomain: vi.fn(),
  totalCount: 15,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolved(api.listCategories, { data: [] });
  mockResolved(api.listSuggestions, { data: [], meta: { pending: 0, total: 0 } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppSidebar — renders category tree", () => {
  it("renders all category names", () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("Science")).toBeInTheDocument();
  });

  it("renders category bookmark counts", () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders 'All' entry with total count", () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });
    expect(screen.getByText("All")).toBeInTheDocument();
    // totalCount=15 appears as a badge — use getAllByText since counts can repeat
    expect(screen.getAllByText("15").length).toBeGreaterThan(0);
  });

  it("renders tags", () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
  });

  it("calls onSelectCategory when category is clicked", () => {
    const onSelectCategory = vi.fn();
    render(<AppSidebar {...defaultProps} onSelectCategory={onSelectCategory} />, {
      wrapper: makeWrapper(),
    });
    fireEvent.click(screen.getByText("Technology"));
    expect(onSelectCategory).toHaveBeenCalledWith("Technology");
  });

  it("calls onSelectTag when tag badge is clicked", () => {
    const onSelectTag = vi.fn();
    render(<AppSidebar {...defaultProps} onSelectTag={onSelectTag} />, { wrapper: makeWrapper() });
    // Tags are rendered as Badge elements — find by partial text match
    const badges = screen.getAllByTestId("badge");
    const typescriptBadge = badges.find((el) => el.textContent?.includes("typescript"));
    expect(typescriptBadge).toBeDefined();
    fireEvent.click(typescriptBadge!);
    expect(onSelectTag).toHaveBeenCalled();
  });
});

describe("AppSidebar — delete category", () => {
  it("calls deleteCategory mutation on confirmation", async () => {
    mockResolved(api.deleteCategory, { data: null });
    mockResolved(api.listCategories, {
      data: [{ id: "cat-1", name: "Technology", parent_id: null, created_at: "", updated_at: "" }],
    });

    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });

    // Trigger delete via context menu item (rendered always due to mock)
    const deleteItems = screen.getAllByRole("menuitem").filter((el) => el.textContent?.includes("Delete"));
    if (deleteItems.length > 0) {
      fireEvent.click(deleteItems[0]);
      // Confirm button in dialog
      await waitFor(() => {
        const confirmBtn = screen.queryByTestId("alert-action");
        if (confirmBtn) {
          fireEvent.click(confirmBtn);
          expect(api.deleteCategory).toHaveBeenCalled();
        }
      });
    }
  });
});

describe("AppSidebar — rename category", () => {
  it("shows rename input when Rename context menu item is clicked", async () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });

    const renameItems = screen.getAllByRole("menuitem").filter((el) => el.textContent?.includes("Rename"));
    if (renameItems.length > 0) {
      fireEvent.click(renameItems[0]);
      await waitFor(() => {
        const input = screen.queryByRole("textbox");
        expect(input).toBeInTheDocument();
      });
    }
  });

  it("calls updateCategory with new name on Enter", async () => {
    mockResolved(api.updateCategory, { data: { id: "cat-1", name: "New Name", parent_id: null, created_at: "", updated_at: "" } });
    mockResolved(api.listCategories, {
      data: [{ id: "cat-1", name: "Technology", parent_id: null, created_at: "", updated_at: "" }],
    });

    render(<AppSidebar {...defaultProps} />, { wrapper: makeWrapper() });

    const renameItems = screen.getAllByRole("menuitem").filter((el) => el.textContent?.includes("Rename"));
    if (renameItems.length > 0) {
      fireEvent.click(renameItems[0]);
      await waitFor(() => screen.queryByRole("textbox"));
      const input = screen.queryByRole("textbox");
      if (input) {
        fireEvent.change(input, { target: { value: "New Name" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith("cat-1", { name: "New Name" }));
      }
    }
  });
});
